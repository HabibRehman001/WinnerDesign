import { catalogBySku, inCorniceRun, inWorktopRun, isFloorNeighbour } from '../catalog'
import { cornerReturnSpan } from './corners'
import { dist, inwardNormal, lerp, mul, norm, projectPointToSegment, sub, wallLength } from './geometry'
import type { CatalogItem, PlacedItem, Wall } from '../types'

export interface CabinetRun {
  wallId: string
  t0: number
  t1: number
  depth: number
  height: number
  elevation: number
  kind: 'base' | 'wall'
  itemIds: string[]
}

function intervals(items: PlacedItem[], wall: Wall, walls: Wall[], accept: (item: CatalogItem) => boolean) {
  const len = wallLength(wall)
  const own = items
    .filter((item) => item.wallId === wall.id && accept(catalogBySku[item.sku]))
    .map((item) => {
      const t = projectPointToSegment(item, wall.a, wall.b).t * len
      return { t0: t - item.width / 2, t1: t + item.width / 2, depth: item.depth, height: item.height, elevation: item.elevation, id: item.id }
    })
  const returns = items.flatMap((item) => {
    const spec = catalogBySku[item.sku]
    if (!spec || (spec.style !== 'corner' && spec.style !== 'carousel') || !accept(spec)) return []
    const span = cornerReturnSpan(item, walls, wall)
    return span ? [span] : []
  })
  return [...own, ...returns].sort((a, b) => a.t0 - b.t0)
}

export function buildRuns(items: PlacedItem[], walls: Wall[], kind: 'base' | 'wall'): CabinetRun[] {
  const runs: CabinetRun[] = []
  for (const wall of walls) {
    const segs = intervals(items, wall, walls, (spec) => (kind === 'base' ? inWorktopRun(spec) : inCorniceRun(spec) && spec.style !== 'hood'))
    let current: CabinetRun | null = null
    for (const seg of segs) {
      if (!current || seg.t0 > current.t1 + 40) {
        if (current) runs.push(current)
        current = { wallId: wall.id, t0: seg.t0, t1: seg.t1, depth: seg.depth, height: seg.height, elevation: seg.elevation, kind, itemIds: [seg.id] }
      } else {
        current.t1 = Math.max(current.t1, seg.t1)
        current.depth = Math.max(current.depth, seg.depth)
        current.height = Math.max(current.height, seg.height)
        current.elevation = Math.min(current.elevation, seg.elevation)
        current.itemIds.push(seg.id)
      }
    }
    if (current) runs.push(current)
  }
  return runs
}

export function runPose(run: CabinetRun, wall: Wall, walls: Wall[], depth: number, frontOverhang = 0) {
  const len = wallLength(wall) || 1
  const along = norm(sub(wall.b, wall.a))
  const inward = inwardNormal(wall, walls)
  const mid = lerp(wall.a, wall.b, (run.t0 + run.t1) / 2 / len)
  const inner = { x: mid.x + inward.x * (wall.thickness / 2), y: mid.y + inward.y * (wall.thickness / 2) }
  const totalDepth = depth + frontOverhang
  const center = { x: inner.x + inward.x * (totalDepth / 2), y: inner.y + inward.y * (totalDepth / 2) }
  return {
    center,
    inward,
    along,
    length: run.t1 - run.t0,
    depth: totalDepth,
    rotation: Math.atan2(-inward.x, inward.y),
    inner,
  }
}

export function exposedSideCount(item: PlacedItem, items: PlacedItem[], walls: Wall[]) {
  const spec = catalogBySku[item.sku]
  const wall = walls.find((entry) => entry.id === item.wallId)
  if (!spec || !wall) return 0
  const floor = isFloorNeighbour(spec)
  const len = wallLength(wall)
  const t = projectPointToSegment(item, wall.a, wall.b).t * len
  let count = 0
  for (const side of [-1, 1]) {
    const edge = t + side * (item.width / 2)
    const covered = items.some((other) => {
      if (other.id === item.id || other.wallId !== item.wallId) return false
      const otherSpec = catalogBySku[other.sku]
      if (!otherSpec) return false
      const sameBand = floor ? isFloorNeighbour(otherSpec) : otherSpec.mount === 'wall'
      if (!sameBand) return false
      const ot = projectPointToSegment(other, wall.a, wall.b).t * len
      return edge >= ot - other.width / 2 - 25 && edge <= ot + other.width / 2 + 25
    })
    if (!covered) count += 1
  }
  return count
}

export function alongPoint(wall: Wall, distance: number) {
  const len = wallLength(wall) || 1
  return lerp(wall.a, wall.b, distance / len)
}

export function unitInterval(item: PlacedItem, wall: Wall) {
  const len = wallLength(wall) || 1
  const t = projectPointToSegment(item, wall.a, wall.b).t * len
  return { t0: t - item.width / 2, t1: t + item.width / 2, t }
}

export { dist, mul }
