import * as BABYLON from 'babylonjs'
import { catalogBySku } from '../../catalog'
import { designWarnings } from '../../lib/checks'
import { sceneCapture } from '../../lib/capture'
import { orderedLoop, offsetLoop, pointInPoly, roomCentroid } from '../../lib/geometry'
import { kelvinToHex, sunVector } from '../../lib/lighting'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useDesignStore } from '../../store/useDesignStore'
import type { DesignOptions, Materials, PlacedItem, Selection } from '../../types'
import { applyHinge, buildItem, hingeProperty, hingeValue, type BuiltItem, type Hinge } from './cabinets'
import { buildJoinery } from './joinery'
import { MaterialBank, linear } from './materials'
import type { BuildContext } from './parts'
import { buildEnvironment, buildRoom } from './room'

interface HingeBinding {
  itemId: string
  hinge: Hinge
  animation: BABYLON.Animation
}

export class DesignViewport {
  readonly engine: BABYLON.Engine
  readonly scene: BABYLON.Scene
  private readonly orbit: BABYLON.ArcRotateCamera
  private readonly walk: BABYLON.UniversalCamera
  private readonly sun: BABYLON.DirectionalLight
  private readonly fill: BABYLON.HemisphericLight
  private readonly ambient: BABYLON.HemisphericLight
  private readonly shadows: BABYLON.ShadowGenerator
  private readonly highlight: BABYLON.HighlightLayer
  private readonly warnings: BABYLON.HighlightLayer
  private readonly bank: MaterialBank
  private ssao: BABYLON.SSAO2RenderingPipeline | null = null
  private ssr: BABYLON.SSRRenderingPipeline | null = null
  private probe: BABYLON.ReflectionProbe | null = null
  private leds: BABYLON.PointLight[] = []
  private content: BABYLON.TransformNode[] = []
  private hinges: HingeBinding[] = []
  private built: BuiltItem[] = []
  private signature = ''
  private lightSignature = ''
  private openSignature = ''
  private selectionKey = ''
  private mode: 'orbit' | 'walk' = 'orbit'
  private framed = ''
  private walking = false
  private keys = new Set<string>()
  private yaw = 0
  private pitch = -0.1
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true })
    this.scene = new BABYLON.Scene(this.engine)
    this.scene.clearColor = BABYLON.Color4.FromHexString('#D5DDE6FF')
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true
    this.scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES
    this.scene.imageProcessingConfiguration.exposure = 1.05
    this.bank = new MaterialBank(this.scene)

    this.orbit = new BABYLON.ArcRotateCamera('orbit', -0.9, 1.05, 9, new BABYLON.Vector3(2, 1.05, 1.6), this.scene)
    this.orbit.lowerRadiusLimit = 1.2
    this.orbit.upperRadiusLimit = 28
    this.orbit.upperBetaLimit = Math.PI / 2.05
    this.orbit.wheelPrecision = 40
    this.orbit.attachControl(canvas, true)

    this.walk = new BABYLON.UniversalCamera('walk', new BABYLON.Vector3(2, 1.6, 1.6), this.scene)
    this.walk.minZ = 0.05

    this.fill = new BABYLON.HemisphericLight('fill', new BABYLON.Vector3(0, 1, 0), this.scene)
    this.fill.diffuse = linear('#F7F8FB')
    this.fill.groundColor = linear('#C9B8A4')
    this.ambient = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), this.scene)
    this.sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.4, -1, -0.3), this.scene)
    this.sun.shadowMinZ = 0.5
    this.sun.shadowMaxZ = 40
    this.shadows = new BABYLON.ShadowGenerator(2048, this.sun)
    this.shadows.usePercentageCloserFiltering = true
    this.shadows.bias = 0.0004
    this.highlight = new BABYLON.HighlightLayer('selection', this.scene)
    this.highlight.innerGlow = false
    this.warnings = new BABYLON.HighlightLayer('warnings', this.scene)
    this.warnings.innerGlow = false
    this.scene.activeCamera = this.orbit

    this.scene.onPointerObservable.add((info) => {
      if (info.type !== BABYLON.PointerEventTypes.POINTERPICK || !info.pickInfo?.hit) return
      const itemId = itemOf(info.pickInfo.pickedMesh ?? null)
      if (!itemId) return
      const store = useDesignStore.getState()
      const item = store.items.find((entry) => entry.id === itemId)
      if (!item) return
      store.setSelection({ type: 'item', id: itemId })
      if (catalogBySku[item.sku]) store.updateItem(itemId, { open: (item.open ?? 0) > 8 ? 0 : 78 })
    })

    this.engine.runRenderLoop(() => {
      if (this.disposed) return
      this.stepWalk()
      this.scene.render()
    })

    sceneCapture.grab = () => canvas.toDataURL('image/jpeg', 0.72)
    sceneCapture.exportPng = (width, height, filename) => this.exportPng(width, height, filename)
    this.sync()
  }

  setMode(mode: 'orbit' | 'walk') {
    if (this.mode === mode) return
    this.mode = mode
    const canvas = this.engine.getRenderingCanvas()
    if (mode === 'walk') {
      this.orbit.detachControl()
      const center = roomCentroid(useDesignStore.getState().walls)
      this.walk.position.set(center.x / 1000, 1.6, center.y / 1000)
      this.yaw = 0
      this.pitch = -0.1
      this.scene.activeCamera = this.walk
      canvas?.addEventListener('pointerdown', this.onWalkDown)
      window.addEventListener('pointerup', this.onWalkUp)
      canvas?.addEventListener('pointermove', this.onWalkMove)
      window.addEventListener('keydown', this.onKeyDown)
      window.addEventListener('keyup', this.onKeyUp)
    } else {
      canvas?.removeEventListener('pointerdown', this.onWalkDown)
      window.removeEventListener('pointerup', this.onWalkUp)
      canvas?.removeEventListener('pointermove', this.onWalkMove)
      window.removeEventListener('keydown', this.onKeyDown)
      window.removeEventListener('keyup', this.onKeyUp)
      this.keys.clear()
      this.scene.activeCamera = this.orbit
      if (canvas) this.orbit.attachControl(canvas, true)
    }
    this.applyPipelines()
  }

  resize() {
    this.engine.resize()
  }

  sync() {
    const state = useDesignStore.getState()
    const next = geometryKey(state)
    if (next !== this.signature) {
      this.signature = next
      this.rebuild(state)
    }
    const lights = lightKey(state.options, state.materials, state.items)
    if (lights !== this.lightSignature) {
      this.lightSignature = lights
      this.applyLights(state.options, state.items)
    }
    const open = state.items.map((item) => `${item.id}:${item.open ?? 0}`).join('|')
    if (open !== this.openSignature) {
      this.openSignature = open
      this.animateFronts(state.items)
    }
    const selection = selectionKey(state.selection)
    if (selection !== this.selectionKey) {
      this.selectionKey = selection
      this.applySelection(state.selection)
    }
    this.applyWarnings(state.items, state.walls, state.fixtures)
  }

  dispose() {
    this.disposed = true
    this.setMode('orbit')
    sceneCapture.grab = null
    sceneCapture.exportPng = null
    this.ssao?.dispose()
    this.ssr?.dispose()
    this.probe?.dispose()
    this.bank.dispose()
    this.scene.dispose()
    this.engine.dispose()
  }

  private rebuild(state: ReturnType<typeof useDesignStore.getState>) {
    this.scene.stopAllAnimations()
    const shadowList = this.shadows.getShadowMap()?.renderList
    if (shadowList) shadowList.length = 0
    for (const root of this.content) root.dispose(false, false)
    this.content = []
    this.hinges = []
    this.built = []
    this.bank.dispose()
    const ctx: BuildContext = { scene: this.scene, bank: this.bank, shadows: this.shadows }
    const environment = buildEnvironment(ctx, state.walls)
    const room = buildRoom(ctx, state)
    const joinery = buildJoinery(ctx, state)
    this.content.push(environment.root, room, joinery)
    for (const item of state.items) {
      const spec = catalogBySku[item.sku]
      if (!spec) continue
      const built = buildItem(ctx, item, spec, state)
      this.built.push(built)
      this.content.push(built.root)
      built.hinges.forEach((hinge, index) => {
        const animation = new BABYLON.Animation(`hinge-${item.id}-${index}`, hingeProperty(hinge), 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT)
        animation.setKeys([
          { frame: 0, value: hingeValue(hinge, 0) },
          { frame: 60, value: hingeValue(hinge, item.open ?? 0) },
        ])
        this.hinges.push({ itemId: item.id, hinge, animation })
        applyHinge(hinge, item.open ?? 0)
      })
    }
    this.refreshProbe(environment.sky)
    this.frame(state)
    this.openSignature = ''
    this.selectionKey = ''
    this.lightSignature = ''
  }

  private refreshProbe(sky: BABYLON.Mesh) {
    this.probe?.dispose()
    const options = useDesignStore.getState().options
    if (!options.screenReflections) {
      this.probe = null
      this.scene.environmentTexture = null
      return
    }
    const center = roomCentroid(useDesignStore.getState().walls)
    const probe = new BABYLON.ReflectionProbe('room-probe', 256, this.scene, true, true)
    probe.position.set(center.x / 1000, 1.4, center.y / 1000)
    probe.renderList?.push(sky)
    this.scene.environmentTexture = probe.cubeTexture
    this.scene.environmentIntensity = 0.85
    this.probe = probe
  }

  private frame(state: ReturnType<typeof useDesignStore.getState>) {
    const center = roomCentroid(state.walls)
    const key = `${center.x}:${center.y}:${state.options.roofStyle}`
    const target = new BABYLON.Vector3(center.x / 1000, 1.05, center.y / 1000)
    this.orbit.target.copyFrom(target)
    if (this.framed === key) return
    this.framed = key
    const height = state.options.roofStyle === 'flat' ? 4.4 : 5.6
    this.orbit.setPosition(new BABYLON.Vector3(center.x / 1000 + 4.8, height, center.y / 1000 + 6.6))
  }

  private applyLights(options: DesignOptions, items: PlacedItem[]) {
    const center = roomCentroid(useDesignStore.getState().walls)
    const sun = sunVector(center, options.sunAzimuth, options.sunElevation)
    this.sun.position.set(sun[0], sun[1], sun[2])
    this.sun.setDirectionToTarget(new BABYLON.Vector3(center.x / 1000, 1.2, center.y / 1000))
    const warm = options.sunElevation < 22
    this.sun.intensity = options.sunIntensity
    this.sun.diffuse = linear(warm ? '#FFB27A' : '#FFF4E4')
    const ambient = warm ? 0.22 : options.lighting === 'studio' ? 0.55 : 0.38
    this.fill.intensity = ambient
    this.ambient.intensity = ambient * 0.35
    for (const light of this.leds) light.dispose()
    this.leds = []
    if (options.underLights) {
      const color = linear(kelvinToHex(options.ledKelvin))
      for (const item of items) {
        if (catalogBySku[item.sku]?.mount !== 'wall') continue
        const light = new BABYLON.PointLight(`led-${item.id}`, new BABYLON.Vector3(item.x / 1000, item.elevation / 1000 - 0.05, item.y / 1000), this.scene)
        light.diffuse = color
        light.intensity = options.ledIntensity * 8
        light.range = 2.4
        this.leds.push(light)
      }
    }
    this.applyPipelines()
  }

  private applyPipelines() {
    const options = useDesignStore.getState().options
    const camera = this.scene.activeCamera
    this.ssao?.dispose()
    this.ssr?.dispose()
    this.ssao = null
    this.ssr = null
    if (!camera) return
    if (options.ambientOcclusion) {
      this.ssao = new BABYLON.SSAO2RenderingPipeline('ssao', this.scene, 0.75, [camera])
      this.ssao.radius = 0.6
      this.ssao.totalStrength = 1.1
      this.ssao.base = 0.15
    }
    if (options.screenReflections) {
      this.ssr = new BABYLON.SSRRenderingPipeline('ssr', this.scene, [camera], false, BABYLON.Constants.TEXTURETYPE_UNSIGNED_BYTE)
      this.ssr.strength = 0.7
      this.ssr.reflectionSpecularFalloffExponent = 2
      this.ssr.step = 2
    }
  }

  private animateFronts(items: PlacedItem[]) {
    for (const binding of this.hinges) {
      const item = items.find((entry) => entry.id === binding.itemId)
      if (!item) continue
      const from = hingeValue(binding.hinge, 0)
      const current = binding.hinge.mode === 'swing' ? binding.hinge.pivot.rotation.y : binding.hinge.mode === 'flap' ? binding.hinge.pivot.rotation.x : binding.hinge.pivot.position.z
      const to = hingeValue(binding.hinge, item.open ?? 0)
      if (Math.abs(current - to) < 0.001) continue
      binding.animation.setKeys([
        { frame: 0, value: Number.isFinite(current) ? current : from },
        { frame: 18, value: to },
      ])
      this.scene.beginDirectAnimation(binding.hinge.pivot, [binding.animation], 0, 18, false, 1.4)
    }
  }

  private applyWarnings(items: PlacedItem[], walls: ReturnType<typeof useDesignStore.getState>['walls'], fixtures: ReturnType<typeof useDesignStore.getState>['fixtures']) {
    this.warnings.removeAllMeshes()
    const warnings = designWarnings(items, walls, fixtures)
    const ids = new Set(warnings.map((warning) => warning.itemId))
    const tint = linear('#E11D48')
    let warningMeshes = 0
    for (const built of this.built) {
      const id = built.root.metadata?.itemId as string | undefined
      if (!id || !ids.has(id)) continue
      for (const mesh of built.root.getChildMeshes(false)) {
        const alpha = (mesh.material as BABYLON.PBRMaterial | null)?.alpha
        if (alpha != null && alpha < 1) continue
        let node: BABYLON.Node | null = mesh
        let front = false
        while (node) {
          if (node.name === 'front') {
            front = true
            break
          }
          node = node.parent
        }
        if (front) continue
        this.warnings.addMesh(mesh as BABYLON.Mesh, tint)
        warningMeshes += 1
      }
    }
    // #region agent log
    const opened = items.filter((item) => (item.open ?? 0) > 1).map((item) => ({ id: item.id, sku: item.sku, open: item.open ?? 0, warned: ids.has(item.id) }))
    fetch('http://127.0.0.1:7769/ingest/6710b84c-c925-44b4-91c7-80543495934e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17d69f'},body:JSON.stringify({sessionId:'17d69f',hypothesisId:'A-C',location:'viewport.ts:applyWarnings',message:'warning highlight',data:{warningCount:warnings.length,messages:warnings.map((warning)=>warning.message).slice(0,8),warnedIds:[...ids],warningMeshes,innerGlow:this.warnings.innerGlow,opened},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  private applySelection(selection: Selection | null) {
    this.highlight.removeAllMeshes()
    if (selection?.type !== 'item') return
    const built = this.built.find((entry) => entry.root.metadata?.itemId === selection.id)
    if (!built) return
    const meshes = built.root.getChildMeshes(false)
    let selectedMeshes = 0
    const colours: string[] = []
    for (const mesh of meshes) {
      const material = mesh.material as BABYLON.PBRMaterial | null
      if (material?.alpha != null && material.alpha < 1) continue
      this.highlight.addMesh(mesh as BABYLON.Mesh, linear('#F59E0B'))
      selectedMeshes += 1
      if (colours.length < 4 && material?.albedoColor) colours.push(material.albedoColor.toHexString())
    }
    // #region agent log
    const item = useDesignStore.getState().items.find((entry) => entry.id === selection.id)
    fetch('http://127.0.0.1:7769/ingest/6710b84c-c925-44b4-91c7-80543495934e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17d69f'},body:JSON.stringify({sessionId:'17d69f',hypothesisId:'B-D-E',location:'viewport.ts:applySelection',message:'selection highlight',data:{itemId:selection.id,sku:item?.sku,open:item?.open??0,selectedMeshes,innerGlow:this.highlight.innerGlow,albedo:colours},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  private stepWalk() {
    if (this.mode !== 'walk') return
    // Babylon applies Euler angles in YXZ order, so yaw and pitch stay independent.
    this.walk.rotation.y = this.yaw
    this.walk.rotation.x = this.pitch
    if (this.keys.size === 0) return
    const forward = new BABYLON.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    const right = new BABYLON.Vector3(forward.z, 0, -forward.x)
    const move = BABYLON.Vector3.Zero()
    if (this.keys.has('w')) move.addInPlace(forward)
    if (this.keys.has('s')) move.subtractInPlace(forward)
    if (this.keys.has('d')) move.addInPlace(right)
    if (this.keys.has('a')) move.subtractInPlace(right)
    if (move.lengthSquared() === 0) return
    move.normalize().scaleInPlace((this.keys.has('shift') ? 2.6 : 1.35) * (this.engine.getDeltaTime() / 1000))
    const next = this.walk.position.add(move)
    const walls = useDesignStore.getState().walls
    const loop = orderedLoop(walls)
    const inner = loop ? offsetLoop(loop.points, loop.walls.map((wall) => wall.thickness / 2 + 200)) : null
    if (!inner || pointInPoly({ x: next.x * 1000, y: next.z * 1000 }, inner)) {
      this.walk.position.x = next.x
      this.walk.position.z = next.z
      this.walk.position.y = 1.6
    }
  }

  private onWalkDown = (event: PointerEvent) => {
    this.walking = true
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  private onWalkUp = () => {
    this.walking = false
  }

  private onWalkMove = (event: PointerEvent) => {
    if (!this.walking) return
    this.yaw += event.movementX * 0.005
    this.pitch = Math.max(-1.05, Math.min(0.7, this.pitch - event.movementY * 0.005))
  }

  private onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.key.toLowerCase())
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase())
  }

  private exportPng(width: number, height: number, filename: string) {
    const camera = this.scene.activeCamera
    if (!camera) return Promise.resolve()
    return BABYLON.CreateScreenshotUsingRenderTargetAsync(this.engine, camera, { width, height }, 'image/png', 4, true).then((data) => {
      const link = document.createElement('a')
      link.href = data
      link.download = filename
      link.click()
    })
  }
}

function itemOf(mesh: BABYLON.Node | null): string | null {
  let current: BABYLON.Node | null = mesh
  while (current) {
    const id = (current.metadata as { itemId?: string } | null)?.itemId
    if (id) return id
    current = current.parent
  }
  return null
}

function geometryKey(state: ReturnType<typeof useDesignStore.getState>) {
  const items = state.items.map(({ open: _open, ...item }) => item)
  return JSON.stringify({
    walls: state.walls,
    openings: state.openings,
    fixtures: state.fixtures,
    items,
    materials: state.materials,
    options: state.options,
    catalog: useCatalogStore.getState().revision,
  })
}

function lightKey(options: DesignOptions, materials: Materials, items: PlacedItem[]) {
  return JSON.stringify({
    lighting: options.lighting,
    sun: [options.sunAzimuth, options.sunElevation, options.sunIntensity],
    led: [options.ledKelvin, options.ledIntensity, options.underLights],
    ao: options.ambientOcclusion,
    ssr: options.screenReflections,
    paint: materials.wallPaint,
    leds: items.filter((item) => catalogBySku[item.sku]?.mount === 'wall').map((item) => [item.id, item.x, item.y, item.elevation]),
  })
}

function selectionKey(selection: Selection | null) {
  return selection ? `${selection.type}:${selection.id}` : ''
}
