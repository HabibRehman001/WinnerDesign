import * as BABYLON from 'babylonjs'
import earcut from 'earcut'
import { offsetLoop, orderedLoop, roomCentroid, wallLength } from '../../lib/geometry'
import { createRoofGeometry, wallProfile } from '../../lib/roof'
import type { DesignOptions, Fixture, Materials, Opening, Pt, Wall } from '../../types'
import { box, clamp, cylinder, finishMesh, lerp, node, type BuildContext } from './parts'

export interface RoomInput {
  walls: Wall[]
  openings: Opening[]
  fixtures: Fixture[]
  materials: Materials
  options: DesignOptions
}

const GLASS = { color: '#B9DDF5', roughness: 0.05, metallic: 0.05, alpha: 0.35 }

export function buildRoom(ctx: BuildContext, input: RoomInput) {
  const root = node(ctx, 'room', null)
  buildFloor(ctx, root, input)
  buildRoof(ctx, root, input)
  for (const wall of input.walls) {
    buildWall(ctx, root, wall, input.walls, input.openings.filter((opening) => opening.wallId === wall.id), input.materials.wallPaint, input.options)
  }
  buildFixtures(ctx, root, input.fixtures, input.options.ceiling)
  return root
}

/** Sky dome and ground plane, centred on the room. Returns the sky so a reflection probe can capture it. */
export function buildEnvironment(ctx: BuildContext, walls: Wall[]) {
  const center = roomCentroid(walls)
  const root = node(ctx, 'environment', null)
  const sky = BABYLON.MeshBuilder.CreateSphere('sky', { diameter: 72, segments: 16, sideOrientation: BABYLON.Mesh.BACKSIDE }, ctx.scene)
  sky.material = ctx.bank.sky('#FBFCFE', '#E7EDF3', '#C5CED8')
  sky.parent = root
  sky.isPickable = false
  sky.infiniteDistance = false
  sky.position.set(center.x / 1000, 0, center.y / 1000)
  sky.metadata = { environment: true }

  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, ctx.scene)
  ground.position.set(center.x / 1000, -0.01, center.y / 1000)
  finishMesh(ctx, ground, { color: '#D5DBE3', roughness: 1 }, root, false)
  ground.isPickable = false
  ground.metadata = { environment: true }
  return { root, sky }
}

function floorOutline(walls: Wall[]): Pt[] {
  const loop = orderedLoop(walls)
  if (loop) return offsetLoop(loop.points, loop.walls.map((wall) => wall.thickness / 2))
  if (!walls.length) {
    return [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ]
  }
  const xs = walls.flatMap((wall) => [wall.a.x, wall.b.x])
  const ys = walls.flatMap((wall) => [wall.a.y, wall.b.y])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

function buildFloor(ctx: BuildContext, root: BABYLON.TransformNode, input: RoomInput) {
  const outline = floorOutline(input.walls)
  if (outline.length < 3) return
  const shape = outline.map((point) => new BABYLON.Vector3(point.x / 1000, 0, point.y / 1000))
  const xs = shape.map((point) => point.x)
  const zs = shape.map((point) => point.z)
  const spanX = Math.max(...xs) - Math.min(...xs)
  const spanZ = Math.max(...zs) - Math.min(...zs)
  const floor = BABYLON.MeshBuilder.CreatePolygon('floor', { shape, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, ctx.scene, earcut)
  floor.position.y = 0.005
  floor.material = ctx.bank.tiles(input.materials.floorTile, input.materials.grout, input.materials.tileSize, spanX, spanZ)
  floor.receiveShadows = true
  floor.parent = root
  floor.metadata = { floor: true }
}

function buildRoof(ctx: BuildContext, root: BABYLON.TransformNode, input: RoomInput) {
  const positions = createRoofGeometry(input.walls, input.options)
  if (!positions) return
  const mesh = new BABYLON.Mesh('roof', ctx.scene)
  const data = new BABYLON.VertexData()
  data.positions = positions
  data.indices = positions.map((_, index) => index).slice(0, positions.length / 3)
  const normals: number[] = []
  BABYLON.VertexData.ComputeNormals(data.positions, data.indices, normals)
  data.normals = normals
  data.applyToMesh(mesh)
  finishMesh(ctx, mesh, { color: '#D5DBE3', roughness: 0.86 }, root)
}

interface Hole {
  t0: number
  t1: number
  y0: number
  y1: number
}

function buildWall(ctx: BuildContext, root: BABYLON.TransformNode, wall: Wall, walls: Wall[], openings: Opening[], paint: string, options: DesignOptions) {
  const length = wallLength(wall) / 1000
  if (length < 0.02) return
  const thick = wall.thickness / 1000
  const profile = wallProfile(wall, walls, options)
  const ha = profile.ha / 1000
  const hb = profile.hb / 1000
  const peak = profile.peak == null ? null : profile.peak / 1000
  const heightAt = (t: number) => {
    if (peak == null) return lerp(ha, hb, t / length)
    const mid = length / 2
    if (t <= mid) return lerp(ha, peak, t / mid)
    return lerp(peak, hb, (t - mid) / (length - mid))
  }
  const edge = 0.005
  const holes: Hole[] = openings
    .map((opening) => {
      const t0 = clamp((opening.offset - opening.width / 2) / 1000, edge, length - edge)
      const t1 = clamp((opening.offset + opening.width / 2) / 1000, edge, length - edge)
      const roof = Math.min(heightAt(t0), heightAt(t1)) - 0.02
      return { t0, t1, y0: Math.max(0, opening.sill / 1000), y1: Math.min(roof, (opening.sill + opening.height) / 1000) }
    })
    .filter((hole) => hole.t1 - hole.t0 > 0.01 && hole.y1 - hole.y0 > 0.01)
    .sort((a, b) => a.t0 - b.t0)

  const notches: Hole[] = []
  const inner: Hole[] = []
  for (const hole of holes) {
    if (hole.y0 <= 0.02) {
      const last = notches[notches.length - 1]
      if (last && hole.t0 <= last.t1 + 0.005) {
        last.t1 = Math.max(last.t1, hole.t1)
        last.y1 = Math.max(last.y1, hole.y1)
      } else notches.push({ ...hole, y0: 0 })
    } else if (!inner.some((other) => hole.t0 < other.t1 && hole.t1 > other.t0 && hole.y0 < other.y1 && hole.y1 > other.y0)) {
      inner.push({ ...hole, y1: Math.min(hole.y1, Math.min(heightAt(hole.t0), heightAt(hole.t1)) - 0.02) })
    }
  }
  const free = inner.filter((hole) => !notches.some((notch) => hole.t0 < notch.t1 && hole.t1 > notch.t0))

  const outline: [number, number][] = [[0, 0]]
  for (const notch of notches) outline.push([notch.t0, 0], [notch.t0, notch.y1], [notch.t1, notch.y1], [notch.t1, 0])
  outline.push([length, 0], [length, hb])
  if (peak != null) outline.push([length / 2, peak])
  outline.push([0, ha])

  const toShape = (points: [number, number][]) => points.map(([t, y]) => new BABYLON.Vector3(t, 0, y))
  const mesh = BABYLON.MeshBuilder.ExtrudePolygon(
    `wall-${wall.id}`,
    {
      shape: toShape(outline),
      holes: free.map((hole) => toShape([[hole.t0, hole.y0], [hole.t1, hole.y0], [hole.t1, hole.y1], [hole.t0, hole.y1]])),
      depth: thick,
    },
    ctx.scene,
    earcut,
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(-length / 2, 0, -thick / 2)

  const theta = Math.atan2(-(wall.b.y - wall.a.y), wall.b.x - wall.a.x)
  const frame = node(ctx, `wall-frame-${wall.id}`, root, [(wall.a.x + wall.b.x) / 2000, 0, (wall.a.y + wall.b.y) / 2000], [0, theta, 0])
  frame.metadata = { wallId: wall.id }
  finishMesh(ctx, mesh, { color: paint, roughness: 0.92 }, frame)
  for (const opening of openings) buildOpening(ctx, frame, opening, length)
}

function buildOpening(ctx: BuildContext, frame: BABYLON.TransformNode, opening: Opening, length: number) {
  const center = opening.offset / 1000 - length / 2
  const width = opening.width / 1000
  const y0 = opening.sill / 1000
  const y1 = (opening.sill + opening.height) / 1000
  if (opening.type === 'window') {
    box(ctx, [width - 0.04, y1 - y0 - 0.04, 0.012], GLASS, frame, [center, (y0 + y1) / 2, 0], [0, 0, 0], false)
    return
  }
  if (opening.type === 'door') {
    const dir = opening.flip ? -1 : 1
    const hinge = node(ctx, 'door-hinge', frame, [center + (opening.flip ? width / 2 : -width / 2), 0, 0], [0, dir * 0.55, 0])
    box(ctx, [width, y1 - y0, 0.04], { color: '#F4F1EA', roughness: 0.55 }, hinge, [(dir * width) / 2, (y1 - y0) / 2, 0])
    return
  }
  box(ctx, [width - 0.02, y1 - y0 - 0.02, 0.02], { color: '#D9D3CB', roughness: 0.8 }, frame, [center, (y0 + y1) / 2, 0.04])
}

function buildFixtures(ctx: BuildContext, root: BABYLON.TransformNode, fixtures: Fixture[], ceilingMm: number) {
  const ceiling = ceilingMm / 1000
  for (const fixture of fixtures) {
    const x = fixture.x / 1000
    const z = fixture.y / 1000
    const w = fixture.width / 1000
    const d = fixture.depth / 1000
    const group = node(ctx, `fixture-${fixture.id}`, root, [x, 0, z], [0, -fixture.rotation, 0])
    group.metadata = { fixtureId: fixture.id }
    if (fixture.type === 'pipe') {
      const height = (fixture.height ?? ceilingMm) / 1000
      cylinder(ctx, w / 2, w / 2, height, { color: '#8D949C', metallic: 0.65, roughness: 0.28 }, group, [0, height / 2, 0])
      continue
    }
    if (fixture.type === 'dormer') {
      const h = (fixture.height ?? 1100) / 1000
      const y = ceiling * 0.62
      box(ctx, [w, h, d], { color: '#E7E1D8', roughness: 0.8 }, group, [0, y, 0])
      box(ctx, [w - 0.2, h * 0.45, 0.02], { ...GLASS, alpha: 0.45 }, group, [0, y + 0.05, d / 2], [0, 0, 0], false)
      continue
    }
    const height = fixture.type === 'beam' ? 0.2 : ceiling
    const y = fixture.type === 'beam' ? ceiling - 0.1 : height / 2
    const color = fixture.type === 'chimney' ? '#A65448' : fixture.type === 'beam' ? '#4E555E' : '#9AA3AD'
    box(ctx, [w, height, d], { color, roughness: 0.8 }, group, [0, y, 0])
  }
}
