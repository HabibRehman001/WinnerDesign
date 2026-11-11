import { add, dist, inwardNormal, lerp, mul, projectPointToSegment, rotationFromInward, same, wallLength } from './geometry'
import type { Handing, PlacedItem, Pt, Wall } from '../types'

export interface WallJoint {
  point: Pt
  wall: Wall
  other: Wall
  atStart: boolean
  otherAtStart: boolean
}

export function wallJoints(walls: Wall[]): WallJoint[] {
  const joints: WallJoint[] = []
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wall = walls[i]
      const other = walls[j]
      const ends: [Pt, Pt, boolean, boolean][] = [
        [wall.a, other.a, true, true],
        [wall.a, other.b, true, false],
        [wall.b, other.a, false, true],
        [wall.b, other.b, false, false],
      ]
      for (const [left, right, atStart, otherAtStart] of ends) {
        if (!same(left, right, 8)) continue
        joints.push({ point: left, wall, other, atStart, otherAtStart })
        break
      }
    }
  }
  return joints
}

export function nearestCornerPose(point: Pt, size: { width: number; depth: number }, walls: Wall[], limit = 450) {
  let best: { joint: WallJoint; distance: number } | null = null
  for (const joint of wallJoints(walls)) {
    const distance = dist(point, joint.point)
    if (distance > limit) continue
    if (!best || distance < best.distance) best = { joint, distance }
  }
  if (!best) return null
  const { joint } = best
  const onWall = projectPointToSegment(point, joint.wall.a, joint.wall.b).distance
  const onOther = projectPointToSegment(point, joint.other.a, joint.other.b).distance
  const primary = onWall <= onOther ? joint.wall : joint.other
  const atStart = primary.id === joint.wall.id ? joint.atStart : joint.otherAtStart
  const len = wallLength(primary) || 1
  const margin = Math.min(size.width / 2, len / 2)
  const along = atStart ? margin : len - margin
  const inward = inwardNormal(primary, walls)
  const origin = lerp(primary.a, primary.b, along / len)
  const center = add(add(origin, mul(inward, primary.thickness / 2)), mul(inward, size.depth / 2))
  const handing: Handing = atStart ? 'left' : 'right'
  return { x: center.x, y: center.y, rotation: rotationFromInward(inward), wallId: primary.id, handing }
}

/** How far a corner unit occupies the return wall, so end gaps on that leg can take a filler. */
export function cornerReturnSpan(item: PlacedItem, walls: Wall[], wall: Wall) {
  const primary = walls.find((entry) => entry.id === item.wallId)
  if (!primary || wall.id === primary.id) return null
  const atStart = item.handing !== 'right'
  const corner = atStart ? primary.a : primary.b
  const atOtherStart = same(corner, wall.a, 12)
  const atOtherEnd = same(corner, wall.b, 12)
  if (!atOtherStart && !atOtherEnd) return null
  const len = wallLength(wall)
  const along = Math.max(150, item.depth)
  const t0 = atOtherEnd && !atOtherStart ? Math.max(0, len - along) : 0
  const t1 = atOtherEnd && !atOtherStart ? len : Math.min(len, along)
  const leg = Math.min(560, item.width - 50, item.depth - 50)
  return { t0, t1, depth: Math.max(150, leg), height: item.height, elevation: item.elevation, id: item.id }
}
