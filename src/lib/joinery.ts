import { catalogBySku } from '../catalog'
import { add, dist, inwardNormal, lerp, lineIntersect, mul, pointInPoly, toWorld, wallLength } from './geometry'
import type { CabinetRun } from './runs'
import type { PlacedItem, Pt, Wall } from '../types'

export interface Plate {
  id: string
  ring: Pt[]
  holes: Pt[][]
  bands: { a: Pt; b: Pt }[]
  mitred: boolean
  runHeight: number
  runElevation: number
}

interface Quad {
  run: CabinetRun
  wall: Wall
  inner0: Pt
  inner1: Pt
  front0: Pt
  front1: Pt
  depth: number
}

export interface PlateBuild {
  extra?: number
  depthOf?: (run: CabinetRun) => number
  insetOf?: (run: CabinetRun) => number
  cutouts?: boolean
}

function quadOf(run: CabinetRun, wall: Wall, walls: Wall[], build: PlateBuild): Quad | null {
  const len = wallLength(wall)
  if (len < 1) return null
  const inward = inwardNormal(wall, walls)
  const inset = Math.max(0, build.insetOf?.(run) ?? 0)
  const span = Math.max(24, build.depthOf?.(run) ?? run.depth + (build.extra ?? 0))
  const at = (t: number, extra: number): Pt => {
    const p = lerp(wall.a, wall.b, t / len)
    return add(p, mul(inward, wall.thickness / 2 + extra))
  }
  return {
    run,
    wall,
    inner0: at(run.t0, inset),
    inner1: at(run.t1, inset),
    front0: at(run.t0, inset + span),
    front1: at(run.t1, inset + span),
    depth: span,
  }
}

function touches(quad: Quad, point: Pt) {
  const len = wallLength(quad.wall)
  if (dist(quad.wall.a, point) < 50 && quad.run.t0 < 180) return 'start' as const
  if (dist(quad.wall.b, point) < 50 && len - quad.run.t1 < 180) return 'end' as const
  return null
}

function cutoutRing(item: PlacedItem): Pt[] {
  const hw = item.width * 0.46
  const hd = item.depth * 0.46
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ].map((point) => toWorld(point, item, item.rotation))
}

export function buildPlates(runs: CabinetRun[], walls: Wall[], items: PlacedItem[], build: PlateBuild = {}): Plate[] {
  const quads = runs.flatMap((run) => {
    const wall = walls.find((entry) => entry.id === run.wallId)
    if (!wall) return []
    const quad = quadOf(run, wall, walls, build)
    return quad ? [quad] : []
  })
  const atStart = new Map<number, { I: Pt; M: Pt }>()
  const atEnd = new Map<number, { I: Pt; M: Pt }>()

  for (let i = 0; i < quads.length; i++) {
    for (let j = i + 1; j < quads.length; j++) {
      const a = quads[i]
      const b = quads[j]
      if (a.wall.id === b.wall.id) continue
      for (const pa of [a.wall.a, a.wall.b]) {
        for (const pb of [b.wall.a, b.wall.b]) {
          if (dist(pa, pb) > 45) continue
          const ea = touches(a, pa)
          const eb = touches(b, pb)
          if (!ea || !eb) continue
          const inner = lineIntersect(a.inner0, a.inner1, b.inner0, b.inner1)
          const front = lineIntersect(a.front0, a.front1, b.front0, b.front1)
          if (!inner || !front) continue
          if (dist(inner, front) > Math.max(a.depth, b.depth) * 2.4) continue
          if (dist(inner, pa) > Math.max(a.depth, b.depth) + 500) continue
          if (ea === 'start') atStart.set(i, { I: inner, M: front })
          else atEnd.set(i, { I: inner, M: front })
          if (eb === 'start') atStart.set(j, { I: inner, M: front })
          else atEnd.set(j, { I: inner, M: front })
        }
      }
    }
  }

  const plates = quads.map((quad, index) => {
    const start = atStart.get(index)
    const end = atEnd.get(index)
    const inner0 = start ? start.I : quad.inner0
    const inner1 = end ? end.I : quad.inner1
    const front1 = end ? end.M : quad.front1
    const front0 = start ? start.M : quad.front0
    return {
      id: `${quad.wall.id}-${Math.round(quad.run.t0)}-${Math.round(quad.run.t1)}`,
      ring: [inner0, inner1, front1, front0],
      holes: [] as Pt[][],
      bands: [{ a: front0, b: front1 }],
      mitred: Boolean(start || end),
      runHeight: quad.run.height,
      runElevation: quad.run.elevation,
    }
  })

  if (build.cutouts) {
    for (const item of items) {
      const spec = catalogBySku[item.sku]
      if (!spec || !['hob', 'sink-bowl', 'basin'].includes(spec.style)) continue
      const hole = cutoutRing(item)
      const plate = plates.find((entry) => pointInPoly(item, entry.ring))
      if (plate) plate.holes.push(hole)
    }
  }
  return plates
}
