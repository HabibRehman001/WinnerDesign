import * as BABYLON from 'babylonjs'
import { DOOR_STYLES } from '../../catalog'
import { layoutFronts, type LaidFront } from '../../lib/fronts'
import type { CatalogItem, DesignOptions, DoorStyle, HandlePlacement, Materials, PlacedItem } from '../../types'
import type { Finish } from './materials'
import { box, cylinder, node, sphere, type BuildContext } from './parts'

type Front = LaidFront

export interface Hinge {
  pivot: BABYLON.TransformNode
  mode: 'swing' | 'flap' | 'slide' | 'fixed'
  sign: number
  rest: number
}

export interface BuiltItem {
  root: BABYLON.TransformNode
  hinges: Hinge[]
}

export interface CabinetEnv {
  materials: Materials
  options: DesignOptions
  items: PlacedItem[]
}

const CARCASS: Finish = { color: '#D7D2CB', roughness: 0.72 }
const STEEL: Finish = { color: '#C5CED6', metallic: 0.8, roughness: 0.22 }
const CERAMIC: Finish = { color: '#F7F8F8', roughness: 0.3 }
const GLASS: Finish = { color: '#C5E4F5', roughness: 0.05, alpha: 0.38 }
const FRAME: Finish = { color: '#F7F4EF', roughness: 0.5 }

export function doorFinish(color: string, style: DoorStyle, grain: number): Finish {
  const preset = DOOR_STYLES[style]
  if (style === 'high-gloss') return { color, roughness: 0.12, metallic: 0.06, clearCoat: 1 }
  if (style === 'wood') return { color, roughness: preset.roughness, pattern: 'wood', grain, repeat: 1 }
  return { color, roughness: preset.roughness, clearCoat: preset.clearcoat || undefined }
}

export function hingeValue(hinge: Hinge, degrees: number) {
  const radians = (degrees * Math.PI) / 180
  if (hinge.mode === 'swing' || hinge.mode === 'flap') return hinge.sign * radians
  if (hinge.mode === 'slide') return hinge.rest + (radians / (Math.PI / 2)) * 0.28
  return hinge.rest
}

export function hingeProperty(hinge: Hinge) {
  return hinge.mode === 'swing' ? 'rotation.y' : hinge.mode === 'flap' ? 'rotation.x' : 'position.z'
}

export function applyHinge(hinge: Hinge, degrees: number) {
  const value = hingeValue(hinge, degrees)
  if (hinge.mode === 'swing') hinge.pivot.rotation.y = value
  else if (hinge.mode === 'flap') hinge.pivot.rotation.x = value
  else hinge.pivot.position.z = value
}

export function buildItem(ctx: BuildContext, item: PlacedItem, spec: CatalogItem, env: CabinetEnv): BuiltItem {
  if (['hob', 'sink-bowl', 'tap', 'basin', 'oven', 'fridge-app'].includes(spec.style)) return { root: buildAppliance(ctx, item, spec, env), hinges: [] }
  const { materials, options } = env
  const w = item.width / 1000
  const h = item.height / 1000
  const d = item.depth / 1000
  const plinth = spec.mount === 'floor' && options.autoPlinth && spec.style !== 'bath' && spec.style !== 'wc' ? options.plinthHeight / 1000 : 0
  const carcassH = Math.max(0.05, h - plinth)
  const carcassD = Math.max(0.05, d - 0.02)
  const lift = spec.mount === 'wall' || spec.style === 'hood' ? item.elevation / 1000 : 0
  const root = node(ctx, `item-${item.id}`, null, [item.x / 1000, lift, item.y / 1000], [0, -item.rotation, 0])
  root.metadata = { itemId: item.id }
  const hinges: Hinge[] = []
  const face = doorFinish(materials.doorColor, materials.doorStyle, materials.grainAngle)

  if (spec.style === 'bath') {
    box(ctx, [w, h, d], { color: '#F7F8F8', roughness: 0.35 }, root, [0, h / 2, 0])
    box(ctx, [w - 0.08, 0.04, d - 0.08], { color: '#B7D4E2', roughness: 0.15 }, root, [0, h - 0.04, 0])
  } else if (spec.style === 'wc') {
    box(ctx, [0.38, 0.4, 0.52], CERAMIC, root, [0, 0.2, 0.05])
    box(ctx, [0.36, 0.42, 0.16], CERAMIC, root, [0, 0.62, -0.18])
  } else if (spec.style === 'dishwasher') {
    box(ctx, [w, h, d], { color: '#C5CED6', metallic: 0.75, roughness: 0.22 }, root, [0, h / 2, 0])
  } else if (spec.style === 'hood') {
    box(ctx, [w, h * 0.45, d], { color: '#D5DDE3', metallic: 0.7, roughness: 0.25 }, root, [0, h * 0.25, d * 0.05])
    box(ctx, [w * 0.42, h * 0.5, d * 0.4], STEEL, root, [0, h * 0.72, -d * 0.15])
  } else if (spec.style === 'corner' || spec.style === 'carousel') {
    buildCorner(ctx, root, item, spec, plinth, face)
  } else {
    box(ctx, [w - 0.004, carcassH, carcassD], CARCASS, root, [0, plinth + carcassH / 2, -0.01])
    const hostedSteel = env.items.some((other) => other.hostId === item.id && other.sku === 'FF-60')
    for (const front of layoutFronts(item, spec, plinth)) {
      hinges.push(buildFront(ctx, root, front, d, hostedSteel ? doorFinish('#D5DDE3', 'high-gloss', 0) : face, materials, spec.mount))
    }
    if (materials.handle === 'gola' || materials.handlePlacement === 'handleless') {
      box(ctx, [w - 0.03, 0.016, 0.012], { color: '#1A1D20', roughness: 0.5 }, root, [0, h - 0.012, d / 2 + 0.004])
    }
  }
  return { root, hinges }
}

function buildFront(ctx: BuildContext, root: BABYLON.Node, front: Front, depth: number, face: Finish, materials: Materials, mount: CatalogItem['mount']): Hinge {
  const sign = front.hinge === 'right' || front.hinge === 'bottom' ? 1 : -1
  const hx = front.hinge === 'left' || front.hinge === 'right' ? sign * (front.w / 2) : 0
  const hy = front.hinge === 'top' || front.kind === 'flap' ? front.h / 2 : front.hinge === 'bottom' ? -front.h / 2 : 0
  const anchor = node(ctx, 'front', root, [front.x + hx, front.y + hy, 0])
  const rest = depth / 2 - 0.008
  const pivot = node(ctx, 'pivot', anchor, [0, 0, rest])
  const leaf = node(ctx, 'leaf', pivot, [-hx, -hy, 0])

  if (front.kind === 'oven') box(ctx, [front.w, front.h, 0.02], { color: '#16181C', metallic: 0.4, roughness: 0.18 }, leaf)
  else if (front.kind === 'glass') glassDoor(ctx, leaf, front.w, front.h)
  else if (face.clearCoat !== 1 && materials.doorStyle === 'raised') raised(ctx, leaf, front.w, front.h, face)
  else if (face.clearCoat !== 1 && materials.doorStyle === 'shaker') shaker(ctx, leaf, front.w, front.h, face)
  else box(ctx, [front.w, front.h, 0.018], face, leaf)
  if (front.kind !== 'oven') handle(ctx, leaf, front, materials.handle, materials.handlePlacement, materials.handleColor, mount)

  const flap = front.hinge === 'top' || front.hinge === 'bottom' || front.kind === 'flap'
  const mode: Hinge['mode'] = front.kind === 'oven' ? 'fixed' : flap ? 'flap' : front.kind === 'drawer' || front.hinge === 'center' ? 'slide' : 'swing'
  return { pivot, mode, sign, rest }
}

function shaker(ctx: BuildContext, parent: BABYLON.Node, w: number, h: number, face: Finish) {
  const rail = Math.min(0.045, w * 0.16, h * 0.16)
  const frame = { ...face, roughness: 0.48 }
  box(ctx, [rail, h, 0.02], frame, parent, [-w / 2 + rail / 2, 0, 0])
  box(ctx, [rail, h, 0.02], frame, parent, [w / 2 - rail / 2, 0, 0])
  box(ctx, [w, rail, 0.02], frame, parent, [0, h / 2 - rail / 2, 0])
  box(ctx, [w, rail, 0.02], frame, parent, [0, -h / 2 + rail / 2, 0])
  box(ctx, [Math.max(0.02, w - rail * 2), Math.max(0.02, h - rail * 2), 0.012], { ...face, roughness: 0.55 }, parent, [0, 0, -0.004])
}

function raised(ctx: BuildContext, parent: BABYLON.Node, w: number, h: number, face: Finish) {
  const rail = Math.min(0.055, w * 0.18, h * 0.16)
  shaker(ctx, parent, w, h, face)
  box(ctx, [Math.max(0.02, w - rail * 2.4), Math.max(0.02, h - rail * 2.4), 0.012], { ...face, roughness: 0.4 }, parent, [0, 0, 0.008])
}

function glassDoor(ctx: BuildContext, parent: BABYLON.Node, w: number, h: number) {
  const rail = 0.028
  const paneW = Math.max(0.02, (w - rail * 3) / 2)
  const paneH = Math.max(0.02, (h - rail * 3) / 2)
  box(ctx, [rail, h, 0.02], FRAME, parent, [-w / 2 + rail / 2, 0, 0])
  box(ctx, [rail, h, 0.02], FRAME, parent, [w / 2 - rail / 2, 0, 0])
  box(ctx, [w, rail, 0.02], FRAME, parent, [0, h / 2 - rail / 2, 0])
  box(ctx, [w, rail, 0.02], FRAME, parent, [0, -h / 2 + rail / 2, 0])
  box(ctx, [rail, h - rail * 2, 0.02], FRAME, parent)
  box(ctx, [w - rail * 2, rail, 0.02], FRAME, parent)
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    box(ctx, [paneW, paneH, 0.006], GLASS, parent, [sx * (paneW / 2 + rail / 2), sy * (paneH / 2 + rail / 2), 0], [0, 0, 0], false)
  }
}

function handle(ctx: BuildContext, parent: BABYLON.Node, front: Front, style: Materials['handle'], placement: HandlePlacement, color: string, mount: CatalogItem['mount']) {
  if (style === 'gola' || placement === 'handleless') return
  const metal: Finish = { color, metallic: 0.85, roughness: 0.22 }
  const knob = style === 'knob' || placement === 'knob'
  const horizontal = placement === 'horizontal-top' || front.kind === 'drawer' || front.kind === 'flap' || front.hinge === 'top' || front.hinge === 'bottom' || (placement === 'auto' && mount === 'wall')
  const x = horizontal || knob ? 0 : front.hinge === 'left' ? front.w / 2 - 0.045 : front.hinge === 'right' ? -front.w / 2 + 0.045 : 0
  const y = front.hinge === 'bottom' ? -front.h / 2 + 0.045 : horizontal ? (front.kind === 'drawer' ? 0 : front.h / 2 - 0.045) : 0
  if (knob) {
    const kx = x || (front.hinge === 'left' ? front.w / 2 - 0.05 : front.hinge === 'right' ? -front.w / 2 + 0.05 : 0)
    sphere(ctx, 0.012, { ...metal, metallic: 0.8, roughness: 0.25 }, parent, [kx, horizontal ? y : 0, 0.022])
    return
  }
  box(ctx, horizontal ? [Math.min(0.18, front.w * 0.55), 0.012, 0.018] : [0.012, Math.min(0.18, front.h * 0.38), 0.018], metal, parent, [x, y, 0.02])
}

function buildCorner(ctx: BuildContext, root: BABYLON.Node, item: PlacedItem, spec: CatalogItem, plinth: number, face: Finish) {
  const w = item.width / 1000
  const d = item.depth / 1000
  const h = Math.max(0.05, item.height / 1000 - plinth)
  const leg = Math.min(0.56, w - 0.05, d - 0.05)
  const side = item.handing === 'right' ? 1 : -1
  const group = node(ctx, 'corner', root, [0, plinth, 0])
  box(ctx, [w, h, leg], { ...CARCASS, roughness: 0.7 }, group, [0, h / 2, -d / 2 + leg / 2])
  box(ctx, [leg, h, d], { ...CARCASS, roughness: 0.7 }, group, [side * (w / 2 - leg / 2), h / 2, 0])
  box(ctx, [leg - 0.02, h - 0.01, 0.018], face, group, [side * (w / 2 - leg / 2), h / 2, d / 2 - 0.01])
  if (spec.style === 'carousel') {
    const shelf = cylinder(ctx, leg * 0.85, leg * 0.85, h - 0.02, { color: face.color, roughness: 0.5 }, group, [side * (w / 2 - leg), h / 2, -d / 2 + leg], 0.25)
    shelf.rotation.y = side > 0 ? Math.PI : Math.PI / 2
  }
}

function buildAppliance(ctx: BuildContext, item: PlacedItem, spec: CatalogItem, env: CabinetEnv) {
  const host = env.items.find((entry) => entry.id === item.hostId)
  const yBase = (host ? host.height : item.elevation) / 1000 + (env.options.autoWorktop ? env.options.worktopThickness / 1000 : 0)
  const w = item.width / 1000
  const d = item.depth / 1000
  const root = node(ctx, `item-${item.id}`, null, [item.x / 1000, 0, item.y / 1000], [0, -item.rotation, 0])
  root.metadata = { itemId: item.id }
  const chrome: Finish = { color: '#D5DDE3', metallic: 0.9, roughness: 0.18 }
  if (spec.style === 'hob') box(ctx, [w, 0.012, d], { color: '#1B1E22', metallic: 0.45, roughness: 0.18 }, root, [0, yBase + 0.006, 0.02])
  if (spec.style === 'sink-bowl') box(ctx, [w, 0.16, d], { ...STEEL, metallic: 0.85, roughness: 0.2 }, root, [0, yBase - 0.075, 0.02])
  if (spec.style === 'tap' || spec.style === 'basin') {
    const group = node(ctx, 'tap', root, [0, yBase, spec.style === 'tap' ? -d : 0])
    if (spec.style === 'basin') box(ctx, [w, 0.1, d], { ...CERAMIC, roughness: 0.25 }, group, [0, 0.04, 0])
    cylinder(ctx, 0.012, 0.014, 0.28, chrome, group, [0, 0.16, spec.style === 'basin' ? -d / 2 : 0])
  }
  if (spec.style === 'oven' && host) box(ctx, [host.width / 1000 - 0.05, 0.58, 0.025], { color: '#111315', metallic: 0.35, roughness: 0.2 }, root, [0, 0.63, host.depth / 2000])
  if (spec.style === 'fridge-app') box(ctx, [w, item.height / 1000, d], { color: '#E8ECEF', metallic: 0.3, roughness: 0.3 }, root, [0, item.height / 2000, 0])
  return root
}

