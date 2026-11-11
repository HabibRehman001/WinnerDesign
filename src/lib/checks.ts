import { catalogBySku } from '../catalog'
import { dist, projectPointToSegment, wallLength } from './geometry'
import type { Fixture, PlacedItem, Wall } from '../types'

export interface DesignWarning {
  itemId: string
  message: string
}

const HOB_GAP = 50
const CORNER_GAP = 80

function corners(item: PlacedItem) {
  const hw = item.width / 2
  const hd = item.depth / 2
  const c = Math.cos(item.rotation)
  const s = Math.sin(item.rotation)
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([x, y]) => ({ x: item.x + x * c - y * s, y: item.y + x * s + y * c }))
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.min(a1, b1) - Math.max(a0, b0) > 20
}

function boxesOverlap(a: PlacedItem, b: PlacedItem) {
  const ac = corners(a)
  const bc = corners(b)
  const axes = [0, 1].flatMap((index) => {
    const next = (index + 1) % 4
    return [
      { x: ac[next].x - ac[index].x, y: ac[next].y - ac[index].y },
      { x: bc[next].x - bc[index].x, y: bc[next].y - bc[index].y },
    ]
  })
  for (const axis of axes) {
    const length = Math.hypot(axis.x, axis.y) || 1
    const project = (points: { x: number; y: number }[]) => points.map((point) => (point.x * axis.x + point.y * axis.y) / length)
    const ap = project(ac)
    const bp = project(bc)
    const overlap = Math.min(Math.max(...ap), Math.max(...bp)) - Math.max(Math.min(...ap), Math.min(...bp))
    if (overlap <= 20) return false
  }
  return true
}

function sameBand(a: PlacedItem, b: PlacedItem) {
  const sa = catalogBySku[a.sku]
  const sb = catalogBySku[b.sku]
  if (!sa || !sb) return false
  const floor = (style: string, mount: string) => mount === 'floor' || ['hob', 'sink-bowl', 'tap', 'basin', 'oven'].includes(style)
  return floor(sa.style, sa.mount) === floor(sb.style, sb.mount)
}

export function designWarnings(items: PlacedItem[], walls: Wall[], fixtures: Fixture[]): DesignWarning[] {
  const warnings: DesignWarning[] = []
  const placed = items.filter((item) => catalogBySku[item.sku])
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      if (a.hostId === b.id || b.hostId === a.id || (a.hostId && a.hostId === b.hostId)) continue
      if (!sameBand(a, b) || !boxesOverlap(a, b)) continue
      warnings.push({ itemId: a.id, message: `${catalogBySku[a.sku].name} overlaps ${catalogBySku[b.sku].name}` })
      warnings.push({ itemId: b.id, message: `${catalogBySku[b.sku].name} overlaps ${catalogBySku[a.sku].name}` })
    }
  }
  for (const item of placed) {
    const spec = catalogBySku[item.sku]
    const wall = walls.find((entry) => entry.id === item.wallId)
    if (spec.style === 'hob' && wall) {
      const len = wallLength(wall)
      const t = projectPointToSegment(item, wall.a, wall.b).t * len
      const left = t - item.width / 2
      const right = len - (t + item.width / 2)
      if (left < HOB_GAP || right < HOB_GAP) warnings.push({ itemId: item.id, message: 'Hob needs 50 mm clearance from the wall end' })
    }
    if ((spec.style === 'oven-tower' || spec.style === 'oven') && wall) {
      const front = corners(item)
      for (const other of walls) {
        if (other.id === wall.id) continue
        const near = front.some((point) => {
          const hit = projectPointToSegment(point, other.a, other.b)
          return hit.distance < other.thickness / 2 + CORNER_GAP
        })
        if (near) {
          warnings.push({ itemId: item.id, message: 'Oven door swing is too close to a return wall' })
          break
        }
      }
    }
    if (spec.category === 'tall' || item.height > 1600) {
      for (const fixture of fixtures) {
        if (fixture.type !== 'beam') continue
        if (dist(item, fixture) < item.depth / 2 + fixture.depth / 2 + 40 && rangesOverlap(item.elevation, item.elevation + item.height, 0, 3000)) {
          warnings.push({ itemId: item.id, message: 'Tall unit clashes with a beam' })
        }
      }
    }
  }
  return warnings
}

export function endClearance(item: PlacedItem, wall: Wall) {
  const len = wallLength(wall)
  const t = projectPointToSegment(item, wall.a, wall.b).t * len
  return {
    left: Math.round(t - item.width / 2),
    right: Math.round(len - (t + item.width / 2)),
  }
}
