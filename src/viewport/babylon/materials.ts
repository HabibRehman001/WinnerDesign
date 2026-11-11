import * as BABYLON from 'babylonjs'

export interface Finish {
  color: string
  roughness?: number
  metallic?: number
  alpha?: number
  emissive?: string
  emissiveIntensity?: number
  clearCoat?: number
  /** Procedural surface drawn into the albedo map. */
  pattern?: 'wood' | 'stone'
  /** Pattern direction in degrees. */
  grain?: number
  /** Pattern repeats per metre of surface. */
  repeat?: number
}

const MAX_LIGHTS = 16

export function linear(hex: string) {
  return BABYLON.Color3.FromHexString(normalizeHex(hex)).toLinearSpace()
}

function normalizeHex(hex: string) {
  const value = hex.trim()
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toUpperCase()
  return '#CCCCCC'
}

export class MaterialBank {
  private readonly cache = new Map<string, BABYLON.PBRMaterial>()
  private readonly textures = new Map<string, BABYLON.Texture>()

  constructor(private readonly scene: BABYLON.Scene) {}

  get(finish: Finish) {
    const key = JSON.stringify(finish)
    const hit = this.cache.get(key)
    if (hit) return hit
    const material = new BABYLON.PBRMaterial(`pbr-${this.cache.size}`, this.scene)
    material.albedoColor = linear(finish.color)
    material.roughness = finish.roughness ?? 0.8
    material.metallic = finish.metallic ?? 0
    material.maxSimultaneousLights = MAX_LIGHTS
    material.backFaceCulling = false
    material.twoSidedLighting = true
    material.realTimeFiltering = true
    if (finish.alpha != null && finish.alpha < 1) {
      material.alpha = finish.alpha
      material.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND
    }
    if (finish.emissive) {
      material.emissiveColor = linear(finish.emissive)
      material.emissiveIntensity = finish.emissiveIntensity ?? 1
    }
    if (finish.clearCoat) {
      material.clearCoat.isEnabled = true
      material.clearCoat.intensity = finish.clearCoat
      material.clearCoat.roughness = 0.08
    }
    if (finish.pattern) {
      material.albedoColor = BABYLON.Color3.White()
      material.albedoTexture = this.pattern(finish.pattern, finish.color, finish.grain ?? 0, finish.repeat ?? 1)
    }
    this.cache.set(key, material)
    return material
  }

  tiles(color: string, grout: string, tileSizeMm: number, spanX: number, spanZ: number, angle = 0) {
    const key = `tile|${color}|${grout}|${tileSizeMm}|${spanX.toFixed(2)}|${spanZ.toFixed(2)}|${angle}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const texture = new BABYLON.DynamicTexture(`tile-${this.textures.size}`, { width: 256, height: 256 }, this.scene, true)
    const ctx = texture.getContext() as CanvasRenderingContext2D
    ctx.fillStyle = grout
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = color
    const groutPx = Math.max(2, Math.round((3 / Math.max(50, tileSizeMm)) * 256))
    ctx.fillRect(groutPx, groutPx, 256 - groutPx * 2, 256 - groutPx * 2)
    texture.update()
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE
    const tile = Math.max(0.05, tileSizeMm / 1000)
    texture.uScale = spanX / tile
    texture.vScale = spanZ / tile
    texture.wAng = (angle * Math.PI) / 180
    this.textures.set(key, texture)
    const material = new BABYLON.PBRMaterial(`floor-${this.cache.size}`, this.scene)
    material.albedoTexture = texture
    material.roughness = 0.82
    material.metallic = 0
    material.maxSimultaneousLights = MAX_LIGHTS
    material.realTimeFiltering = true
    this.cache.set(key, material)
    return material
  }

  /** Unlit gradient used for the studio sky dome. */
  sky(top: string, middle: string, bottom: string) {
    const key = `sky|${top}|${middle}|${bottom}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const texture = new BABYLON.DynamicTexture('sky', { width: 4, height: 512 }, this.scene, false)
    const ctx = texture.getContext() as CanvasRenderingContext2D
    const gradient = ctx.createLinearGradient(0, 0, 0, 512)
    gradient.addColorStop(0, top)
    gradient.addColorStop(0.45, middle)
    gradient.addColorStop(1, bottom)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 4, 512)
    texture.update()
    const material = new BABYLON.PBRMaterial('sky-mat', this.scene)
    material.unlit = true
    material.albedoTexture = texture
    material.backFaceCulling = false
    this.cache.set(key, material)
    return material
  }

  private pattern(kind: 'wood' | 'stone', color: string, grain: number, repeat: number) {
    const key = `${kind}|${color}|${grain}|${repeat}`
    const hit = this.textures.get(key)
    if (hit) return hit
    const texture = new BABYLON.DynamicTexture(`${kind}-${this.textures.size}`, { width: 512, height: 512 }, this.scene, true)
    const ctx = texture.getContext() as CanvasRenderingContext2D
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 512, 512)
    if (kind === 'wood') {
      ctx.strokeStyle = 'rgba(0,0,0,0.13)'
      for (let i = 0; i < 72; i++) {
        const y = i * 7 + (i % 3)
        ctx.lineWidth = 1 + (i % 4 === 0 ? 1.5 : 0)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(150, y + 6, 330, y - 5, 512, y + 2)
        ctx.stroke()
      }
    } else {
      let seed = 17
      const rand = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      ctx.strokeStyle = 'rgba(70,70,80,0.18)'
      for (let i = 0; i < 9; i++) {
        let x = 0
        let y = rand() * 512
        ctx.lineWidth = 0.6 + rand() * 1.6
        ctx.beginPath()
        ctx.moveTo(x, y)
        while (x < 512) {
          x += 18 + rand() * 30
          y += (rand() - 0.5) * 36
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }
    texture.update()
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE
    texture.wAng = (grain * Math.PI) / 180
    texture.uScale = repeat
    texture.vScale = repeat
    this.textures.set(key, texture)
    return texture
  }

  dispose() {
    for (const material of this.cache.values()) material.dispose(true, true)
    for (const texture of this.textures.values()) texture.dispose()
    this.cache.clear()
    this.textures.clear()
  }
}
