import { lerp, projectPointToSegment, wallLength } from './geometry'
import type { Fixture, Opening, Pt, Wall } from '../types'

export function clearancePoint(point: Pt, width: number, wall: Wall, fixtures: Fixture[], openings: Opening[], tall: boolean) {
  const len = wallLength(wall) || 1
  const projected = projectPointToSegment(point, wall.a, wall.b)
  let t = projected.t * len
  const blocks: { t0: number; t1: number }[] = []
  for (const opening of openings) {
    if (opening.wallId !== wall.id || opening.type !== 'niche') continue
    blocks.push({ t0: opening.offset - opening.width / 2 - 30, t1: opening.offset + opening.width / 2 + 30 })
  }
  for (const fixture of fixtures) {
    if (fixture.type === 'dormer') continue
    if (fixture.type === 'beam' && !tall) continue
    const along = projectPointToSegment(fixture, wall.a, wall.b)
    if (fixture.wallId && fixture.wallId !== wall.id && along.distance > fixture.depth + 120) continue
    if (along.distance > 750) continue
    const pad = fixture.width / 2 + (fixture.type === 'pipe' ? 80 : 40)
    blocks.push({ t0: along.t * len - pad, t1: along.t * len + pad })
  }
  const fits = (cursor: number) => {
    if (cursor - width / 2 < -4 || cursor + width / 2 > len + 4) return false
    return !blocks.some((block) => cursor + width / 2 > block.t0 && cursor - width / 2 < block.t1)
  }
  if (!fits(t)) {
    for (let step = 10; step <= len; step += 10) {
      if (fits(t - step)) {
        t = t - step
        break
      }
      if (fits(t + step)) {
        t = t + step
        break
      }
    }
  }
  return lerp(wall.a, wall.b, t / len)
}
