import { dist, lerp, norm, sub, wallLength } from './geometry'
import type { DesignOptions, Pt, Wall } from '../types'

export interface WallProfile {
  ha: number
  hb: number
  peak: number | null
}

function shares(point: Pt, wall: Wall) {
  return dist(point, wall.a) < 45 || dist(point, wall.b) < 45
}

export function oppositeWall(wall: Wall, walls: Wall[]) {
  let best: Wall | null = null
  let bestD = 0
  const mid = lerp(wall.a, wall.b, 0.5)
  for (const other of walls) {
    if (other.id === wall.id) continue
    if (shares(other.a, wall) || shares(other.b, wall)) continue
    const gap = dist(mid, lerp(other.a, other.b, 0.5))
    if (gap > bestD) {
      best = other
      bestD = gap
    }
  }
  return best
}

function eaveWalls(walls: Wall[]) {
  const ranked = [...walls].sort((a, b) => wallLength(b) - wallLength(a))
  const first = ranked[0]
  if (!first) return []
  const second = oppositeWall(first, walls) ?? ranked[1]
  return [first, second].filter((wall): wall is Wall => Boolean(wall))
}

export function wallProfile(wall: Wall, walls: Wall[], options: DesignOptions): WallProfile {
  const ceiling = options.ceiling
  if (wall.heightA != null || wall.heightB != null) {
    return { ha: wall.heightA ?? ceiling, hb: wall.heightB ?? ceiling, peak: null }
  }
  if (options.roofStyle === 'flat' || walls.length < 3) {
    return { ha: ceiling, hb: ceiling, peak: null }
  }
  const knee = options.kneeHeight
  const ridge = Math.max(options.ridgeHeight, knee + 200)
  if (options.roofStyle === 'shed') {
    const low = walls.find((entry) => entry.id === options.roofLowWallId) ?? walls[0]
    const high = oppositeWall(low, walls) ?? walls[0]
    if (wall.id === low.id) return { ha: knee, hb: knee, peak: null }
    if (wall.id === high.id) return { ha: ridge, hb: ridge, peak: null }
    return {
      ha: shares(wall.a, low) ? knee : ridge,
      hb: shares(wall.b, low) ? knee : ridge,
      peak: null,
    }
  }
  const eaves = eaveWalls(walls)
  if (eaves.some((entry) => entry.id === wall.id)) return { ha: knee, hb: knee, peak: null }
  return { ha: knee, hb: knee, peak: ridge }
}

function away(wall: Wall, shared: Pt) {
  const fromA = dist(wall.a, shared) <= dist(wall.b, shared)
  return fromA ? norm(sub(wall.b, wall.a)) : norm(sub(wall.a, wall.b))
}

function sharedPoint(a: Wall, b: Wall): Pt | null {
  for (const pa of [a.a, a.b]) {
    for (const pb of [b.a, b.b]) {
      if (dist(pa, pb) < 45) return lerp(pa, pb, 0.5)
    }
  }
  return null
}

export function wallJoints(walls: Wall[]) {
  const joints: { point: Pt; degrees: number }[] = []
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const shared = sharedPoint(walls[i], walls[j])
      if (!shared) continue
      const d1 = away(walls[i], shared)
      const d2 = away(walls[j], shared)
      const dot = Math.min(1, Math.max(-1, d1.x * d2.x + d1.y * d2.y))
      const degrees = Math.round((Math.acos(dot) * 180) / Math.PI)
      if (Math.abs(degrees - 90) > 2) joints.push({ point: shared, degrees })
    }
  }
  return joints
}

function matchEnds(source: Wall, other: Wall) {
  const direct = dist(source.a, other.a) + dist(source.b, other.b)
  const crossed = dist(source.a, other.b) + dist(source.b, other.a)
  if (direct <= crossed) return { a: other.a, b: other.b }
  return { a: other.b, b: other.a }
}

function pushQuad(target: number[], a: Pt, ah: number, b: Pt, bh: number, c: Pt, ch: number, d: Pt, dh: number) {
  const v = (point: Pt, height: number) => [point.x / 1000, height, point.y / 1000]
  target.push(...v(a, ah), ...v(b, bh), ...v(c, ch), ...v(a, ah), ...v(c, ch), ...v(d, dh))
}

/** Triangle soup in metres: x, y (up), z per vertex, three vertices per triangle. */
export function createRoofGeometry(walls: Wall[], options: DesignOptions): number[] | null {
  if (options.roofStyle === 'flat' || walls.length < 3) return null
  const knee = options.kneeHeight / 1000
  const ridge = Math.max(options.ridgeHeight, options.kneeHeight + 200) / 1000
  const positions: number[] = []
  if (options.roofStyle === 'shed') {
    const low = walls.find((entry) => entry.id === options.roofLowWallId) ?? walls[0]
    const high = oppositeWall(low, walls)
    if (!high) return null
    const matched = matchEnds(low, high)
    pushQuad(positions, low.a, knee, low.b, knee, matched.b, ridge, matched.a, ridge)
  } else {
    const eaves = eaveWalls(walls)
    if (eaves.length < 2) return null
    const [near, far] = eaves
    const matched = matchEnds(near, far)
    const ridgeA = lerp(near.a, matched.a, 0.5)
    const ridgeB = lerp(near.b, matched.b, 0.5)
    pushQuad(positions, near.a, knee, near.b, knee, ridgeB, ridge, ridgeA, ridge)
    pushQuad(positions, matched.a, knee, matched.b, knee, ridgeB, ridge, ridgeA, ridge)
  }
  return positions
}
