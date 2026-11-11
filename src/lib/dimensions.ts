import { catalogBySku } from '../catalog'
import { add, clamp, dist, inwardNormal, lerp, mul, projectPointToSegment, sub, wallLength, leftNormal } from './geometry'
import { unitInterval } from './runs'
import type { DimensionAlign, Measure, PlacedItem, Pt, Selection, Wall } from '../types'

const CLOSE_GAP = 160
const AUTO_GAP = 240
const CLOSE_RUN = 140
const AUTO_RUN = 220

export interface DimLine {
  id: string
  selectId: string
  kind: 'overall' | 'run' | 'free'
  wallId?: string
  measureId?: string
  a: Pt
  b: Pt
  from: Pt
  to: Pt
  length: number
  offset: number
  axis: Pt
  origin: Pt
  min: number
  max: number
  draggable: boolean
  gap: boolean
}

export interface ElevationDim {
  selectId: string
  kind: 'overall' | 'run'
  t0: number
  t1: number
  drop: number
  length: number
  gap: boolean
}

export function resolvedAlign(wall: Wall, system: DimensionAlign): DimensionAlign {
  return wall.dimensionAlign ?? system
}

export function layoutDimensions(walls: Wall[], items: PlacedItem[], measures: Measure[], system: DimensionAlign): DimLine[] {
  const lines: DimLine[] = []
  for (const wall of walls) {
    const length = wallLength(wall)
    if (length < 80) continue
    const inward = inwardNormal(wall, walls)
    const outward = mul(inward, -1)
    const mid = lerp(wall.a, wall.b, 0.5)
    const align = resolvedAlign(wall, system)
    const overall = placement(wall, walls, items, 'out', system)
    if (overall != null) {
      const face = wall.thickness / 2
      lines.push({
        id: `overall:${wall.id}`,
        selectId: `overall:${wall.id}`,
        kind: 'overall',
        wallId: wall.id,
        a: add(wall.a, mul(outward, overall)),
        b: add(wall.b, mul(outward, overall)),
        from: add(wall.a, mul(outward, face)),
        to: add(wall.b, mul(outward, face)),
        length,
        offset: overall,
        axis: outward,
        origin: mid,
        min: face + 40,
        max: 2800,
        draggable: align === 'manual',
        gap: false,
      })
    }
    const run = placement(wall, walls, items, 'in', system)
    const segments = runSegments(wall, items)
    if (run == null || !segments.length) continue
    const face = wall.thickness / 2
    segments.forEach((segment, index) => {
      const p0 = along(wall, segment.t0)
      const p1 = along(wall, segment.t1)
      lines.push({
        id: `run:${wall.id}:${index}`,
        selectId: `run:${wall.id}`,
        kind: 'run',
        wallId: wall.id,
        a: add(p0, mul(inward, run)),
        b: add(p1, mul(inward, run)),
        from: add(p0, mul(inward, face)),
        to: add(p1, mul(inward, face)),
        length: segment.t1 - segment.t0,
        offset: run,
        axis: inward,
        origin: mid,
        min: face + 40,
        max: 2800,
        draggable: align === 'manual',
        gap: segment.gap,
      })
    })
  }
  for (const measure of measures ?? []) {
    const line = measureLine(measure)
    if (line) lines.push(line)
  }
  return lines
}

export function measureLine(measure: Measure): DimLine | null {
  const length = dist(measure.a, measure.b)
  if (length < 40) return null
  const axis = leftNormal(sub(measure.b, measure.a))
  const offset = measure.offset
  return {
    id: measure.id,
    selectId: measure.id,
    kind: 'free',
    measureId: measure.id,
    a: add(measure.a, mul(axis, offset)),
    b: add(measure.b, mul(axis, offset)),
    from: measure.a,
    to: measure.b,
    length,
    offset,
    axis,
    origin: measure.a,
    min: -2000,
    max: 2000,
    draggable: true,
    gap: false,
  }
}

export function hitDimension(point: Pt, lines: DimLine[], tolerance: number): DimLine | null {
  let best: DimLine | null = null
  let bestDistance = tolerance
  for (const line of lines) {
    const hit = projectPointToSegment(point, line.a, line.b)
    if (hit.distance < bestDistance) {
      best = line
      bestDistance = hit.distance
    }
  }
  return best
}

export function selectionOf(line: DimLine): Selection {
  if (line.kind === 'free') return { type: 'measure', id: line.measureId ?? line.id }
  return { type: 'dimension', id: line.selectId, wallId: line.wallId ?? '', kind: line.kind }
}

export function elevationDimensions(wall: Wall, items: PlacedItem[], system: DimensionAlign): ElevationDim[] {
  const align = resolvedAlign(wall, system)
  const { run, overall } = drops(align, wall)
  const lines: ElevationDim[] = runSegments(wall, items).map((segment) => ({
    selectId: `run:${wall.id}`,
    kind: 'run',
    t0: segment.t0,
    t1: segment.t1,
    drop: run,
    length: segment.t1 - segment.t0,
    gap: segment.gap,
  }))
  const length = wallLength(wall)
  lines.push({ selectId: `overall:${wall.id}`, kind: 'overall', t0: 0, t1: length, drop: overall, length, gap: false })
  return lines
}

function drops(align: DimensionAlign, wall: Wall) {
  if (align === 'close') return { run: 120, overall: 280 }
  if (align === 'auto') return { run: 200, overall: 400 }
  const run = clamp(wall.runOffset ?? 200, 100, 420)
  const overall = Math.max(run + 160, clamp(wall.dimensionOffset ?? 360, 220, 560))
  return { run, overall }
}

function placement(wall: Wall, walls: Wall[], items: PlacedItem[], side: 'out' | 'in', system: DimensionAlign) {
  const face = faceOf(wall, items, side)
  if (face == null) return null
  const align = resolvedAlign(wall, system)
  const close = face + (side === 'out' ? CLOSE_GAP : CLOSE_RUN)
  if (align === 'manual') {
    const stored = side === 'out' ? wall.dimensionOffset : wall.runOffset
    return stored ?? close
  }
  if (align === 'close') return close
  return autoOffset(wall, walls, items, side, side === 'out' ? AUTO_GAP : AUTO_RUN)
}

function autoOffset(wall: Wall, walls: Wall[], items: PlacedItem[], side: 'out' | 'in', gap: number) {
  const axis = sideAxis(wall, walls, side)
  let maxProjection = -Infinity
  for (const other of walls) {
    const otherAxis = sideAxis(other, walls, side)
    const align = axis.x * otherAxis.x + axis.y * otherAxis.y
    if (align <= 0.85) continue
    const face = faceOf(other, items, side)
    if (face == null) continue
    const mid = lerp(other.a, other.b, 0.5)
    maxProjection = Math.max(maxProjection, mid.x * axis.x + mid.y * axis.y + face * align)
  }
  const mid = lerp(wall.a, wall.b, 0.5)
  const mine = mid.x * axis.x + mid.y * axis.y
  if (!Number.isFinite(maxProjection)) return (faceOf(wall, items, side) ?? 0) + gap
  return maxProjection + gap - mine
}

function sideAxis(wall: Wall, walls: Wall[], side: 'out' | 'in') {
  const inward = inwardNormal(wall, walls)
  return side === 'in' ? inward : mul(inward, -1)
}

function faceOf(wall: Wall, items: PlacedItem[], side: 'out' | 'in') {
  if (side === 'out') return wall.thickness / 2
  const depths = cabinets(wall, items).map((item) => item.depth)
  if (!depths.length) return null
  return wall.thickness / 2 + Math.max(...depths)
}

function cabinets(wall: Wall, items: PlacedItem[]) {
  return items.filter((item) => item.wallId === wall.id && catalogBySku[item.sku]?.mount !== 'inset')
}

function runSegments(wall: Wall, items: PlacedItem[]) {
  const length = wallLength(wall)
  const spans = cabinets(wall, items)
    .map((item) => unitInterval(item, wall))
    .sort((a, b) => a.t0 - b.t0)
  if (!spans.length || length < 80) return []
  const marks = [wall.thickness / 2]
  for (const span of spans) marks.push(span.t0, span.t1)
  marks.push(length - wall.thickness / 2)
  marks.sort((a, b) => a - b)
  const unique: number[] = []
  for (const mark of marks) {
    if (!unique.length || mark - unique[unique.length - 1] > 8) unique.push(mark)
  }
  const segments: { t0: number; t1: number; gap: boolean }[] = []
  for (let index = 0; index < unique.length - 1; index += 1) {
    const t0 = unique[index]
    const t1 = unique[index + 1]
    if (t1 - t0 < 15) continue
    const mid = (t0 + t1) / 2
    const gap = !spans.some((span) => mid >= span.t0 && mid <= span.t1)
    segments.push({ t0, t1, gap })
  }
  return segments
}

function along(wall: Wall, distance: number) {
  const length = wallLength(wall) || 1
  return lerp(wall.a, wall.b, distance / length)
}
