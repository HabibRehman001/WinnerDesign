import { catalogBySku } from '../catalog'
import {
  add,
  buildChains,
  dist,
  formatMm,
  inwardNormal,
  lerp,
  mul,
  nearestWall,
  norm,
  offsetLoop,
  openingQuad,
  orderedLoop,
  polygonAreaM2,
  poseOnWall,
  sub,
  toWorld,
  wallLength,
} from '../lib/geometry'
import { buildPlates } from '../lib/joinery'
import { clearancePoint } from '../lib/obstacles'
import { wallJoints, wallProfile } from '../lib/roof'
import { buildRuns, unitInterval } from '../lib/runs'
import type { DesignOptions, Fixture, Materials, Opening, PlacedItem, Selection, Wall } from '../types'
import type { CatalogItem } from '../types'

export interface Cam {
  x: number
  y: number
  zoom: number
}

export interface PlanDraft {
  snapPoint: PtLike | null
  snapLabel: string
  wallStart: PtLike | null
  hover: Selection | null
  ghostItem: PlacedItem | null
  ghostOpening: Opening | null
  ghostFixture: Fixture | null
  walls: Wall[] | null
  items: PlacedItem[] | null
  defaultThickness: number
}

interface PtLike {
  x: number
  y: number
}

export interface PlanDesign {
  walls: Wall[]
  openings: Opening[]
  fixtures: Fixture[]
  items: PlacedItem[]
  materials: Materials
  options: DesignOptions
  selection: Selection | null
  showDimensions: boolean
  defaultThickness: number
}

function w2s(point: PtLike, cam: Cam, width: number, height: number) {
  return {
    x: (point.x - cam.x) * cam.zoom + width / 2,
    y: (point.y - cam.y) * cam.zoom + height / 2,
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function badge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, tone: 'room' | 'gap' | 'info') {
  ctx.save()
  ctx.font = '600 11px "Segoe UI", Inter, sans-serif'
  const padX = 6
  const w = ctx.measureText(text).width + padX * 2
  const h = 18
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 3)
  if (tone === 'gap') {
    ctx.fillStyle = '#FF6600'
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
  } else if (tone === 'info') {
    ctx.fillStyle = '#0066CC'
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
  } else {
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.strokeStyle = '#8B909A'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#1A1D20'
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 0.5)
  ctx.restore()
}

function pathOf(item: PlacedItem, spec: CatalogItem) {
  const w = item.width
  const d = item.depth
  if (spec.style === 'corner' || spec.style === 'carousel') {
    const t = Math.min(560, w - 40, d - 40)
    const locals =
      item.handing === 'right'
        ? [
            [w / 2, -d / 2],
            [-w / 2, -d / 2],
            [-w / 2, -d / 2 + t],
            [w / 2 - t, -d / 2 + t],
            [w / 2 - t, d / 2],
            [w / 2, d / 2],
          ]
        : [
            [-w / 2, -d / 2],
            [w / 2, -d / 2],
            [w / 2, -d / 2 + t],
            [-w / 2 + t, -d / 2 + t],
            [-w / 2 + t, d / 2],
            [-w / 2, d / 2],
          ]
    return locals.map(([x, y]) => toWorld({ x, y }, item, item.rotation))
  }
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x, y]) => toWorld({ x, y }, item, item.rotation))
}

const FILL: Record<string, string> = {
  base: '#D7E3F0',
  wall: '#EEF3F8',
  tall: '#C5D0DE',
  appliance: '#C5CED6',
  sanitary: '#D5E6E4',
  worktop: '#E7E1D8',
  trim: '#E7E1D8',
}

export function drawPlan(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cam: Cam,
  design: PlanDesign,
  draft: PlanDraft | null,
) {
  const walls = draft?.walls ?? design.walls
  const items = draft?.items ?? design.items
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#F5F6F8'
  ctx.fillRect(0, 0, width, height)
  drawGrid(ctx, width, height, cam)

  const loop = orderedLoop(walls)
  const inner = loop ? offsetLoop(loop.points, loop.walls.map((wall) => wall.thickness / 2)) : null
  if (inner) {
    ctx.beginPath()
    inner.forEach((point, index) => {
      const s = w2s(point, cam, width, height)
      if (index === 0) ctx.moveTo(s.x, s.y)
      else ctx.lineTo(s.x, s.y)
    })
    ctx.closePath()
    ctx.fillStyle = design.materials.floorTile
    ctx.fill()
    ctx.save()
    ctx.clip()
    drawTiles(ctx, width, height, cam, design.materials)
    ctx.restore()
  }

  const chains = buildChains(walls)
  for (const chain of chains) {
    strokeChain(ctx, chain.pts, chain.closed, chain.thickness, cam, width, height, '#E4DFD6', '#8E949E')
  }

  for (const opening of design.openings) {
    const wall = walls.find((entry) => entry.id === opening.wallId)
    if (!wall) continue
    drawOpening(ctx, wall, walls, opening, cam, width, height, false)
  }
  if (draft?.ghostOpening) {
    const wall = walls.find((entry) => entry.id === draft.ghostOpening?.wallId)
    if (wall && draft.ghostOpening) drawOpening(ctx, wall, walls, draft.ghostOpening, cam, width, height, true)
  }

  for (const fixture of design.fixtures) drawFixture(ctx, fixture, cam, width, height, false)
  if (draft?.ghostFixture) drawFixture(ctx, draft.ghostFixture, cam, width, height, true)

  if (design.options.autoWorktop) {
    const plates = buildPlates(buildRuns(items, walls, 'base'), walls, items, { extra: 20, cutouts: true })
    for (const plate of plates) drawPlate(ctx, plate.ring, plate.holes, cam, width, height, design.materials.worktopColor)
  }

  const sorted = [...items].sort((a, b) => {
    const ao = catalogBySku[a.sku]?.category === 'wall' ? 1 : 0
    const bo = catalogBySku[b.sku]?.category === 'wall' ? 1 : 0
    return ao - bo
  })
  for (const item of sorted) drawItem(ctx, item, cam, width, height, design.selection, draft?.hover ?? null, false)
  if (draft?.ghostItem) drawItem(ctx, draft.ghostItem, cam, width, height, null, null, true)

  if (draft?.wallStart && draft.snapPoint && dist(draft.wallStart, draft.snapPoint) > 40) {
    const thickness = draft.defaultThickness
    strokeChain(ctx, [draft.wallStart, draft.snapPoint], false, thickness, cam, width, height, 'rgba(0,102,204,0.35)', '#0066CC')
    const mid = lerp(draft.wallStart, draft.snapPoint, 0.5)
    const screen = w2s(mid, cam, width, height)
    const angle = draft.snapLabel.includes('°') ? ` · ${draft.snapLabel}` : ''
    badge(ctx, screen.x, screen.y - 16, `${formatMm(dist(draft.wallStart, draft.snapPoint))}${angle}`, 'info')
  }

  if (design.showDimensions) {
    drawDimensions(ctx, walls, items, inner, cam, width, height)
    drawSlopes(ctx, walls, design.options, cam, width, height)
    for (const joint of wallJoints(walls)) {
      const screen = w2s(joint.point, cam, width, height)
      badge(ctx, screen.x, screen.y - 14, `Miter ${joint.degrees}°`, 'info')
    }
  }
  drawSelection(ctx, design, walls, items, cam, width, height)
  if (draft?.snapPoint && draft.snapLabel.startsWith('L ')) {
    const s = w2s(draft.snapPoint, cam, width, height)
    badge(ctx, s.x, s.y - 18, draft.snapLabel, 'info')
  }
  if (draft?.snapPoint) {
    const s = w2s(draft.snapPoint, cam, width, height)
    ctx.strokeStyle = draft.snapLabel === 'Endpoint' ? '#00E5FF' : '#0066CC'
    ctx.lineWidth = 1.5
    ctx.strokeRect(s.x - 5, s.y - 5, 10, 10)
  }

  const barMm = cam.zoom > 0.2 ? 500 : cam.zoom > 0.08 ? 1000 : 2000
  const barPx = barMm * cam.zoom
  ctx.fillStyle = '#1A1D20'
  ctx.fillRect(20, height - 28, Math.max(8, barPx), 3)
  ctx.font = '600 11px "Segoe UI", Inter, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(formatMm(barMm), 20, height - 32)
  if (inner) {
    ctx.textAlign = 'right'
    ctx.fillText(`Floor ${polygonAreaM2(inner).toFixed(2)} m²`, width - 16, height - 18)
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, cam: Cam) {
  const topLeft = {
    x: (0 - width / 2) / cam.zoom + cam.x,
    y: (0 - height / 2) / cam.zoom + cam.y,
  }
  const bottomRight = {
    x: (width - width / 2) / cam.zoom + cam.x,
    y: (height - height / 2) / cam.zoom + cam.y,
  }
  let step = cam.zoom >= 0.16 ? 100 : cam.zoom >= 0.07 ? 500 : 1000
  const span = Math.max(bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
  while (span / step > 240) step *= 2
  const major = step * 5
  const x0 = Math.floor(topLeft.x / step) * step
  const y0 = Math.floor(topLeft.y / step) * step
  ctx.beginPath()
  ctx.strokeStyle = '#E1E4EA'
  ctx.lineWidth = 1
  for (let x = x0; x <= bottomRight.x; x += step) {
    const sx = w2s({ x, y: 0 }, cam, width, height).x
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
  }
  for (let y = y0; y <= bottomRight.y; y += step) {
    const sy = w2s({ x: 0, y }, cam, width, height).y
    ctx.moveTo(0, sy)
    ctx.lineTo(width, sy)
  }
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = '#C9CED6'
  const mx0 = Math.floor(topLeft.x / major) * major
  const my0 = Math.floor(topLeft.y / major) * major
  for (let x = mx0; x <= bottomRight.x; x += major) {
    const sx = w2s({ x, y: 0 }, cam, width, height).x
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
  }
  for (let y = my0; y <= bottomRight.y; y += major) {
    const sy = w2s({ x: 0, y }, cam, width, height).y
    ctx.moveTo(0, sy)
    ctx.lineTo(width, sy)
  }
  ctx.stroke()
}

function drawTiles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cam: Cam,
  materials: Materials,
) {
  const tile = materials.tileSize
  const topLeft = { x: (0 - width / 2) / cam.zoom + cam.x, y: (0 - height / 2) / cam.zoom + cam.y }
  const bottomRight = { x: (width - width / 2) / cam.zoom + cam.x, y: (height - height / 2) / cam.zoom + cam.y }
  ctx.beginPath()
  ctx.strokeStyle = materials.grout
  ctx.lineWidth = 1
  for (let x = Math.floor(topLeft.x / tile) * tile; x <= bottomRight.x; x += tile) {
    const sx = w2s({ x, y: 0 }, cam, width, height).x
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
  }
  for (let y = Math.floor(topLeft.y / tile) * tile; y <= bottomRight.y; y += tile) {
    const sy = w2s({ x: 0, y }, cam, width, height).y
    ctx.moveTo(0, sy)
    ctx.lineTo(width, sy)
  }
  ctx.stroke()
}

function strokeChain(
  ctx: CanvasRenderingContext2D,
  pts: PtLike[],
  closed: boolean,
  thickness: number,
  cam: Cam,
  width: number,
  height: number,
  fill: string,
  stroke: string,
) {
  ctx.beginPath()
  pts.forEach((point, index) => {
    const s = w2s(point, cam, width, height)
    if (index === 0) ctx.moveTo(s.x, s.y)
    else ctx.lineTo(s.x, s.y)
  })
  if (closed) ctx.closePath()
  ctx.lineJoin = 'miter'
  ctx.miterLimit = 2
  ctx.lineCap = 'square'
  ctx.strokeStyle = fill
  ctx.lineWidth = Math.max(2, thickness * cam.zoom)
  ctx.stroke()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1.4
  ctx.stroke()
}

function drawOpening(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  walls: Wall[],
  opening: Opening,
  cam: Cam,
  width: number,
  height: number,
  ghost: boolean,
) {
  const quad = openingQuad(wall, opening.offset, opening.width)
  ctx.beginPath()
  quad.forEach((point, index) => {
    const s = w2s(point, cam, width, height)
    if (index === 0) ctx.moveTo(s.x, s.y)
    else ctx.lineTo(s.x, s.y)
  })
  ctx.closePath()
  ctx.fillStyle = ghost ? 'rgba(0,229,255,0.25)' : '#F5F6F8'
  ctx.fill()
  ctx.strokeStyle = ghost ? '#00E5FF' : '#1A1D20'
  ctx.lineWidth = 1.2
  ctx.stroke()
  if (opening.type !== 'door') return
  const len = wallLength(wall) || 1
  const along = norm(sub(wall.b, wall.a))
  const inward = inwardNormal(wall, walls)
  const mid = lerp(wall.a, wall.b, opening.offset / len)
  const hingeSign = opening.flip ? 1 : -1
  const hinge = add(mid, mul(along, hingeSign * (opening.width / 2)))
  const closedDir = mul(along, -hingeSign)
  const leaf = add(hinge, mul(inward, opening.width))
  ctx.beginPath()
  const hs = w2s(hinge, cam, width, height)
  const ls = w2s(leaf, cam, width, height)
  ctx.moveTo(hs.x, hs.y)
  ctx.lineTo(ls.x, ls.y)
  ctx.strokeStyle = '#1A1D20'
  ctx.stroke()
  const a0 = Math.atan2(closedDir.y, closedDir.x)
  let delta = Math.atan2(inward.y, inward.x) - a0
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  ctx.beginPath()
  for (let i = 0; i <= 16; i++) {
    const a = a0 + delta * (i / 16)
    const p = w2s(add(hinge, { x: Math.cos(a) * opening.width, y: Math.sin(a) * opening.width }), cam, width, height)
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()
}

function drawFixture(ctx: CanvasRenderingContext2D, fixture: Fixture, cam: Cam, width: number, height: number, ghost: boolean) {
  ctx.save()
  const center = w2s(fixture, cam, width, height)
  ctx.translate(center.x, center.y)
  ctx.rotate(fixture.rotation)
  const w = fixture.width * cam.zoom
  const d = fixture.depth * cam.zoom
  ctx.globalAlpha = ghost ? 0.55 : 1
  if (fixture.type === 'pipe') {
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(4, w / 2), 0, Math.PI * 2)
    ctx.fillStyle = '#8D949C'
    ctx.fill()
    ctx.strokeStyle = '#1A1D20'
    ctx.stroke()
  } else if (fixture.type === 'dormer') {
    ctx.setLineDash([5, 3])
    ctx.strokeStyle = '#0066CC'
    ctx.strokeRect(-w / 2, -d / 2, w, d)
    ctx.setLineDash([])
  } else if (fixture.type === 'beam') {
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#0066CC'
    ctx.lineWidth = Math.max(4, d)
    ctx.strokeRect(-w / 2, -d / 2, w, d)
  } else {
    ctx.fillStyle = fixture.type === 'chimney' ? '#A65448' : '#9AA3AD'
    ctx.fillRect(-w / 2, -d / 2, w, d)
    ctx.strokeStyle = '#1A1D20'
    ctx.strokeRect(-w / 2, -d / 2, w, d)
  }
  ctx.restore()
  const label = w2s(fixture, cam, width, height)
  ctx.fillStyle = '#1A1D20'
  ctx.font = '600 10px "Segoe UI", Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(fixture.type.toUpperCase(), label.x, label.y + 3)
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  item: PlacedItem,
  cam: Cam,
  width: number,
  height: number,
  selection: Selection | null,
  hover: Selection | null,
  ghost: boolean,
) {
  const spec = catalogBySku[item.sku]
  if (!spec) return
  const selected = selection?.type === 'item' && selection.id === item.id
  const hot = hover?.type === 'item' && hover.id === item.id
  const poly = pathOf(item, spec).map((point) => w2s(point, cam, width, height))
  ctx.beginPath()
  poly.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)))
  ctx.closePath()
  ctx.save()
  ctx.globalAlpha = ghost ? 0.5 : spec.category === 'wall' || spec.mount === 'wall' ? 0.78 : 1
  ctx.fillStyle = FILL[spec.category] ?? '#D7E3F0'
  ctx.fill()
  ctx.restore()
  ctx.setLineDash(spec.category === 'wall' ? [5, 3] : [])
  ctx.lineWidth = selected || ghost ? 2 : 1
  ctx.strokeStyle = selected ? '#FF6600' : hot ? '#00E5FF' : ghost ? '#0066CC' : '#314052'
  ctx.stroke()
  ctx.setLineDash([])
  if (spec.style === 'carousel') {
    ctx.beginPath()
    const arc = w2s(item, cam, width, height)
    ctx.strokeStyle = '#314052'
    ctx.arc(arc.x, arc.y, Math.min(item.width, item.depth) * cam.zoom * 0.35, item.rotation, item.rotation + Math.PI / 2)
    ctx.stroke()
  }
  const screenW = item.width * cam.zoom
  if (screenW > 42) {
    const center = w2s(item, cam, width, height)
    ctx.fillStyle = '#1A1D20'
    ctx.font = '600 11px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(spec.sku, center.x, center.y)
    if (selected) {
      ctx.font = '11px "Segoe UI", Inter, sans-serif'
      ctx.fillText(formatMm(item.width), center.x, center.y + 13)
    }
  }
}

function drawDimensions(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  items: PlacedItem[],
  inner: PtLike[] | null,
  cam: Cam,
  width: number,
  height: number,
) {
  ctx.strokeStyle = '#5C6570'
  ctx.lineWidth = 1
  ctx.fillStyle = '#5C6570'
  if (inner && inner.length >= 3) {
    const centroid = inner.reduce((acc, point) => add(acc, point), { x: 0, y: 0 })
    centroid.x /= inner.length
    centroid.y /= inner.length
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i]
      const b = inner[(i + 1) % inner.length]
      const length = dist(a, b)
      if (length < 80) continue
      const mid = lerp(a, b, 0.5)
      const outward = norm(sub(mid, centroid))
      const lineA = add(a, mul(outward, 240))
      const lineB = add(b, mul(outward, 240))
      const sa = w2s(a, cam, width, height)
      const sb = w2s(b, cam, width, height)
      const la = w2s(lineA, cam, width, height)
      const lb = w2s(lineB, cam, width, height)
      ctx.beginPath()
      ctx.moveTo(sa.x, sa.y)
      ctx.lineTo(la.x, la.y)
      ctx.moveTo(sb.x, sb.y)
      ctx.lineTo(lb.x, lb.y)
      ctx.moveTo(la.x, la.y)
      ctx.lineTo(lb.x, lb.y)
      ctx.stroke()
      const label = w2s(lerp(lineA, lineB, 0.5), cam, width, height)
      badge(ctx, label.x, label.y, formatMm(length), 'room')
    }
  } else {
    for (const wall of walls) {
      const mid = lerp(wall.a, wall.b, 0.5)
      const screen = w2s(mid, cam, width, height)
      badge(ctx, screen.x, screen.y, formatMm(wallLength(wall)), 'room')
    }
  }

  for (const wall of walls) {
    const len = wallLength(wall)
    const group = items.filter((item) => item.wallId === wall.id && catalogBySku[item.sku]?.mount !== 'inset')
    if (!group.length) continue
    const spans = group.map((item) => unitInterval(item, wall)).sort((a, b) => a.t0 - b.t0)
    const marks = [wall.thickness / 2, ...spans.flatMap((span) => [span.t0, span.t1]), len - wall.thickness / 2]
    for (let i = 0; i < marks.length - 1; i += 1) {
      const left = marks[i]
      const right = marks[i + 1]
      const gap = right - left
      if (gap < 20 || gap > 1500) continue
      const at = lerp(wall.a, wall.b, ((left + right) / 2) / len)
      const inward = inwardNormal(wall, walls)
      const pos = add(at, mul(inward, wall.thickness / 2 + 180))
      const screen = w2s(pos, cam, width, height)
      badge(ctx, screen.x, screen.y, formatMm(gap), 'gap')
    }
  }
}

function drawSelection(ctx: CanvasRenderingContext2D, design: PlanDesign, walls: Wall[], items: PlacedItem[], cam: Cam, width: number, height: number) {
  const selection = design.selection
  if (!selection) return
  if (selection.type === 'wall') {
    const wall = walls.find((entry) => entry.id === selection.id)
    if (!wall) return
    const a = w2s(wall.a, cam, width, height)
    const b = w2s(wall.b, cam, width, height)
    ctx.strokeStyle = '#0066CC'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    for (const point of [a, b]) {
      ctx.fillStyle = '#00E5FF'
      ctx.fillRect(point.x - 5, point.y - 5, 10, 10)
    }
    const mid = w2s(lerp(wall.a, wall.b, 0.5), cam, width, height)
    badge(ctx, mid.x, mid.y - 18, formatMm(wall.thickness), 'info')
  }
  if (selection.type === 'item') {
    const item = items.find((entry) => entry.id === selection.id)
    if (!item) return
    for (const edge of [-1, 1]) {
      const point = w2s(toWorld({ x: edge * (item.width / 2), y: 0 }, item, item.rotation), cam, width, height)
      ctx.fillStyle = '#FF6600'
      ctx.fillRect(point.x - 5, point.y - 5, 10, 10)
      ctx.strokeStyle = '#FFFFFF'
      ctx.strokeRect(point.x - 5, point.y - 5, 10, 10)
    }
  }
}

export function hitItem(point: PtLike, item: PlacedItem) {
  const local = {
    x: Math.cos(-item.rotation) * (point.x - item.x) - Math.sin(-item.rotation) * (point.y - item.y),
    y: Math.sin(-item.rotation) * (point.x - item.x) + Math.cos(-item.rotation) * (point.y - item.y),
  }
  return Math.abs(local.x) <= item.width / 2 && Math.abs(local.y) <= item.depth / 2
}

function drawPlate(ctx: CanvasRenderingContext2D, ring: { x: number; y: number }[], holes: { x: number; y: number }[][], cam: Cam, width: number, height: number, color: string) {
  const path = new Path2D()
  ring.forEach((point, index) => {
    const screen = w2s(point, cam, width, height)
    if (index === 0) path.moveTo(screen.x, screen.y)
    else path.lineTo(screen.x, screen.y)
  })
  path.closePath()
  for (const hole of holes) {
    hole.forEach((point, index) => {
      const screen = w2s(point, cam, width, height)
      if (index === 0) path.moveTo(screen.x, screen.y)
      else path.lineTo(screen.x, screen.y)
    })
    path.closePath()
  }
  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = 0.72
  ctx.fill(path, 'evenodd')
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#1A1D20'
  ctx.lineWidth = 1
  ctx.stroke(path)
  ctx.restore()
}

function drawSlopes(ctx: CanvasRenderingContext2D, walls: Wall[], options: DesignOptions, cam: Cam, width: number, height: number) {
  for (const wall of walls) {
    const profile = wallProfile(wall, walls, options)
    const sloped = profile.peak != null || Math.abs(profile.ha - profile.hb) > 8 || (options.roofStyle !== 'flat' && profile.ha < options.ceiling - 8)
    if (!sloped) continue
    const mid = w2s(lerp(wall.a, wall.b, 0.5), cam, width, height)
    const label = profile.peak != null ? `Gable ${Math.round(profile.peak)} mm` : `${Math.round(profile.ha)}–${Math.round(profile.hb)} mm`
    badge(ctx, mid.x, mid.y + 16, label, 'info')
  }
}

export function suggestPlacement(
  point: PtLike,
  spec: CatalogItem,
  walls: Wall[],
  items: PlacedItem[],
  fixtures: Fixture[] = [],
  openings: Opening[] = [],
): Partial<PlacedItem> | null {
  if (spec.style === 'hob' || spec.style === 'sink-bowl' || spec.style === 'tap' || spec.style === 'basin') {
    const hosts = items.filter((item) => {
      const host = catalogBySku[item.sku]
      return host && (host.style === 'sink' || host.category === 'base' || host.category === 'sanitary')
    })
    const host = nearestHost(point, hosts)
    if (!host) return null
    return { x: host.x, y: host.y, rotation: host.rotation, wallId: host.wallId, hostId: host.id, elevation: host.height }
  }
  if (spec.style === 'oven' || spec.style === 'fridge-app') {
    const hosts = items.filter((item) => catalogBySku[item.sku]?.style === (spec.style === 'oven' ? 'oven-tower' : 'fridge'))
    const host = nearestHost(point, hosts)
    if (!host) return null
    return { x: host.x, y: host.y, rotation: host.rotation, wallId: host.wallId, hostId: host.id, elevation: spec.elevation }
  }
  const near = nearestWall(point, walls)
  if (!near || near.distance > 900) return null
  const cleared = clearancePoint(point, spec.width, near.wall, fixtures, openings, spec.category === 'tall' || spec.height > 1600)
  const pose = poseOnWall(cleared, spec.width, spec.depth, near.wall, walls)
  return { x: pose.x, y: pose.y, rotation: pose.rotation, wallId: pose.wallId, elevation: spec.elevation }
}

function nearestHost(point: PtLike, items: PlacedItem[]) {
  let best: PlacedItem | null = null
  let bestD = 900
  for (const item of items) {
    const d = dist(point, item)
    if (d < bestD) {
      best = item
      bestD = d
    }
  }
  return best
}

export function frameOf(walls: Wall[], items: PlacedItem[], width: number, height: number): Cam {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (point: PtLike) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  walls.forEach((wall) => {
    grow(wall.a)
    grow(wall.b)
  })
  items.forEach(grow)
  if (!Number.isFinite(minX)) return { x: 0, y: 0, zoom: 0.16 }
  minX -= 700
  minY -= 700
  maxX += 700
  maxY += 700
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    zoom: Math.max(0.04, Math.min(width / (maxX - minX), height / (maxY - minY))),
  }
}

export function renderPlanDataUrl(design: PlanDesign, width = 1100, height = 760) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const cam = frameOf(design.walls, design.items, width, height)
  drawPlan(ctx, width, height, cam, { ...design, selection: null }, null)
  return canvas.toDataURL('image/jpeg', 0.86)
}
