import type { Fixture, Opening, PlacedItem, Pt, Wall } from '../types'

export function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function mul(a: Pt, s: number): Pt {
  return { x: a.x * s, y: a.y * s }
}

export function norm(a: Pt): Pt {
  const l = Math.hypot(a.x, a.y) || 1
  return { x: a.x / l, y: a.y / l }
}

export function leftNormal(d: Pt): Pt {
  const n = norm(d)
  return { x: -n.y, y: n.x }
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function same(a: Pt, b: Pt, tol = 3) {
  return dist(a, b) <= tol
}

export function formatMm(mm: number) {
  return `${Math.round(mm).toLocaleString('en-GB')} mm`
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function projectPointToSegment(p: Pt, a: Pt, b: Pt) {
  const ab = sub(b, a)
  const l2 = ab.x * ab.x + ab.y * ab.y || 1
  const t = clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2, 0, 1)
  const point = lerp(a, b, t)
  return { point, t, distance: dist(p, point) }
}

export function lineIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x)
  if (Math.abs(d) < 1e-6) return null
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t }
}

export function wallLength(wall: Wall) {
  return dist(wall.a, wall.b)
}

export function roomCentroid(walls: Wall[]): Pt {
  if (!walls.length) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const wall of walls) {
    x += (wall.a.x + wall.b.x) / 2
    y += (wall.a.y + wall.b.y) / 2
  }
  return { x: x / walls.length, y: y / walls.length }
}

export function inwardNormal(wall: Wall, walls: Wall[]): Pt {
  const mid = lerp(wall.a, wall.b, 0.5)
  const n = leftNormal(sub(wall.b, wall.a))
  const toC = sub(roomCentroid(walls), mid)
  return n.x * toC.x + n.y * toC.y >= 0 ? n : mul(n, -1)
}

export function rotationFromInward(inward: Pt) {
  return Math.atan2(-inward.x, inward.y)
}

export function toLocal(p: Pt, origin: Pt, rotation: number): Pt {
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  const c = Math.cos(-rotation)
  const s = Math.sin(-rotation)
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}

export function toWorld(local: Pt, origin: Pt, rotation: number): Pt {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  return {
    x: origin.x + local.x * c - local.y * s,
    y: origin.y + local.x * s + local.y * c,
  }
}

export function polygonAreaM2(points: Pt[]) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const q = points[(i + 1) % points.length]
    area += p.x * q.y - q.x * p.y
  }
  return Math.abs(area) / 2 / 1_000_000
}

export function pointInPoly(p: Pt, poly: Pt[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]
    const pj = poly[j]
    const hit = pi.y > p.y !== pj.y > p.y && p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y || 1) + pi.x
    if (hit) inside = !inside
  }
  return inside
}

export interface WallChain {
  pts: Pt[]
  thickness: number
  closed: boolean
}

export function buildChains(walls: Wall[]): WallChain[] {
  const unused = new Set(walls.map((wall) => wall.id))
  const chains: WallChain[] = []
  while (unused.size) {
    const id = unused.values().next().value as string
    const wall = walls.find((entry) => entry.id === id)
    if (!wall) break
    unused.delete(id)
    const pts = [wall.a, wall.b]
    let grew = true
    while (grew) {
      grew = false
      for (const other of walls) {
        if (!unused.has(other.id) || other.thickness !== wall.thickness) continue
        if (same(other.a, pts[0])) {
          pts.unshift(other.b)
          unused.delete(other.id)
          grew = true
        } else if (same(other.b, pts[0])) {
          pts.unshift(other.a)
          unused.delete(other.id)
          grew = true
        } else if (same(other.a, pts[pts.length - 1])) {
          pts.push(other.b)
          unused.delete(other.id)
          grew = true
        } else if (same(other.b, pts[pts.length - 1])) {
          pts.push(other.a)
          unused.delete(other.id)
          grew = true
        }
      }
    }
    const closed = pts.length > 2 && same(pts[0], pts[pts.length - 1])
    chains.push({ pts: closed ? pts.slice(0, -1) : pts, thickness: wall.thickness, closed })
  }
  return chains
}

export function orderedLoop(walls: Wall[]): { points: Pt[]; walls: Wall[] } | null {
  if (walls.length < 3) return null
  const unused = new Set(walls.map((wall) => wall.id))
  const start = walls[0]
  unused.delete(start.id)
  const seq: Wall[] = [{ ...start }]
  let cursor = start.b
  while (unused.size) {
    const next = walls.find((wall) => unused.has(wall.id) && (same(wall.a, cursor) || same(wall.b, cursor)))
    if (!next) return null
    unused.delete(next.id)
    const oriented = same(next.a, cursor) ? next : { ...next, a: next.b, b: next.a }
    seq.push(oriented)
    cursor = oriented.b
  }
  if (!same(cursor, start.a)) return null
  return { points: seq.map((wall) => ({ ...wall.a })), walls: seq }
}

export function offsetLoop(points: Pt[], distances: number[]): Pt[] {
  const count = points.length
  let area = 0
  for (let i = 0; i < count; i++) {
    const p = points[i]
    const q = points[(i + 1) % count]
    area += p.x * q.y - q.x * p.y
  }
  const sign = area > 0 ? 1 : -1
  const lines = points.map((point, index) => {
    const next = points[(index + 1) % count]
    const offset = mul(leftNormal(sub(next, point)), sign * distances[index])
    return { p: add(point, offset), d: sub(next, point) }
  })
  return lines.map((line, index) => {
    const prev = lines[(index - 1 + count) % count]
    return (
      lineIntersect(prev.p, add(prev.p, prev.d), line.p, add(line.p, line.d)) ?? line.p
    )
  })
}

export function nearestWall(point: Pt, walls: Wall[]) {
  let best: { wall: Wall; distance: number; offset: number; t: number } | null = null
  for (const wall of walls) {
    const proj = projectPointToSegment(point, wall.a, wall.b)
    if (!best || proj.distance < best.distance) {
      best = { wall, distance: proj.distance, offset: proj.t * wallLength(wall), t: proj.t }
    }
  }
  return best
}

export function poseOnWall(point: Pt, width: number, depth: number, wall: Wall, walls: Wall[]) {
  const len = wallLength(wall) || 1
  const proj = projectPointToSegment(point, wall.a, wall.b)
  const margin = Math.min(width / 2, len / 2)
  const t = clamp(proj.t * len, margin, Math.max(margin, len - margin))
  const inward = inwardNormal(wall, walls)
  const alongPoint = lerp(wall.a, wall.b, t / len)
  const center = add(add(alongPoint, mul(inward, wall.thickness / 2)), mul(inward, depth / 2))
  return {
    x: center.x,
    y: center.y,
    rotation: rotationFromInward(inward),
    wallId: wall.id,
    offset: t,
    distance: proj.distance,
  }
}

export function reseatItem<T extends { x: number; y: number; width: number; depth: number; rotation: number; wallId?: string }>(
  item: T,
  wall: Wall,
  walls: Wall[],
): T {
  const len = wallLength(wall)
  if (len < item.width + 8) {
    const inward = inwardNormal(wall, walls)
    return { ...item, rotation: rotationFromInward(inward) }
  }
  const pose = poseOnWall(item, item.width, item.depth, wall, walls)
  return { ...item, x: pose.x, y: pose.y, rotation: pose.rotation, wallId: wall.id }
}

export function reseatFixture(fixture: Fixture, wall: Wall, walls: Wall[]): Fixture {
  if (fixture.type === 'beam') {
    const len = wallLength(wall) || 1
    const proj = projectPointToSegment(fixture, wall.a, wall.b)
    const t = clamp(proj.t * len, fixture.width / 2, Math.max(fixture.width / 2, len - fixture.width / 2))
    const point = lerp(wall.a, wall.b, t / len)
    return {
      ...fixture,
      x: point.x,
      y: point.y,
      depth: wall.thickness,
      rotation: Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x),
      wallId: wall.id,
    }
  }
  return reseatItem(fixture, wall, walls)
}

export function clampOpening(opening: Opening, wall: Wall): Opening {
  const len = wallLength(wall)
  const half = opening.width / 2
  if (len <= opening.width + 20) return { ...opening, offset: len / 2 }
  return { ...opening, offset: clamp(opening.offset, half + 10, len - half - 10) }
}

export function gridSnap(point: Pt, step: number): Pt {
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
  }
}

export function snapAngle(from: Pt, to: Pt, step = 45, tolerance = 7): { point: Pt; locked: boolean; degrees: number } {
  const length = dist(from, to)
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const stepRad = (step * Math.PI) / 180
  const snapped = Math.round(angle / stepRad) * stepRad
  const locked = Math.abs(angle - snapped) < (tolerance * Math.PI) / 180
  const use = locked ? snapped : angle
  return {
    point: { x: from.x + Math.cos(use) * length, y: from.y + Math.sin(use) * length },
    locked,
    degrees: Math.round((use * 180) / Math.PI),
  }
}

export function endpointSnap(point: Pt, walls: Wall[], extras: Pt[], tolerance: number) {
  let best: Pt | null = null
  let bestD = tolerance
  const candidates = [...extras]
  for (const wall of walls) candidates.push(wall.a, wall.b)
  for (const candidate of candidates) {
    const d = dist(point, candidate)
    if (d < bestD) {
      best = candidate
      bestD = d
    }
  }
  return best
}

export function openingQuad(wall: Wall, offset: number, width: number): Pt[] {
  const len = wallLength(wall) || 1
  const along = norm(sub(wall.b, wall.a))
  const side = leftNormal(along)
  const mid = lerp(wall.a, wall.b, offset / len)
  const halfW = width / 2
  const halfT = wall.thickness / 2 + 3
  const c0 = add(mid, mul(along, -halfW))
  const c1 = add(mid, mul(along, halfW))
  return [add(c0, mul(side, halfT)), add(c1, mul(side, halfT)), add(c1, mul(side, -halfT)), add(c0, mul(side, -halfT))]
}

export function boundsOf(walls: Wall[], items: PlacedItem[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (p: Pt) => {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  for (const wall of walls) {
    grow(wall.a)
    grow(wall.b)
  }
  for (const item of items) grow(item)
  if (!Number.isFinite(minX)) return { minX: -500, minY: -500, maxX: 4500, maxY: 3500 }
  return { minX, minY, maxX, maxY }
}
