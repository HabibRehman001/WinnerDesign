import { useEffect, useRef } from 'react'
import { catalogBySku } from '../catalog'
import {
  add,
  clamp,
  dist,
  endpointSnap,
  gridSnap,
  mul,
  nearestWall,
  poseOnWall,
  projectPointToSegment,
  snapAngle,
  toWorld,
  pointInPoly,
  openingQuad,
} from '../lib/geometry'
import { fitPlan, planCamera, screenToWorld, useHudStore } from './camera'
import { openContextMenu } from '../components/ContextMenu'
import { endClearance } from '../lib/checks'
import { drawPlan, hitItem, suggestPlacement, type PlanDraft } from './draw'
import { uid, useDesignStore } from '../store/useDesignStore'
import type { Opening, PlacedItem, Pt, Selection } from '../types'

interface LiveDraft {
  snapPoint: Pt | null
  snapLabel: string
  wallStart: Pt | null
  chainOrigin: Pt | null
  hover: Selection | null
  ghostItem: PlacedItem | null
  ghostOpening: Opening | null
  ghostFixture: PlanDraft['ghostFixture']
  walls: PlanDraft['walls']
  items: PlanDraft['items']
  pan: { sx: number; sy: number; cx: number; cy: number } | null
  dragItem: string | null
  dragHandle: { id: string; edge: 1 | -1; anchor: Pt; rotation: number } | null
  dragEnd: { id: string; end: 'a' | 'b' } | null
  space: boolean
}

const OPENING_PRESETS: Record<'door' | 'window' | 'niche', Pick<Opening, 'type' | 'width' | 'height' | 'sill'>> = {
  door: { type: 'door', width: 826, height: 2040, sill: 0 },
  window: { type: 'window', width: 1200, height: 1200, sill: 900 },
  niche: { type: 'niche', width: 600, height: 720, sill: 1000 },
}

export function FloorPlan() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draftRef = useRef<LiveDraft>({
    snapPoint: null,
    snapLabel: '—',
    wallStart: null,
    chainOrigin: null,
    hover: null,
    ghostItem: null,
    ghostOpening: null,
    ghostFixture: null,
    walls: null,
    items: null,
    pan: null,
    dragItem: null,
    dragHandle: null,
    dragEnd: null,
    space: false,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const draft = draftRef.current
    let fitted = false
    let raf = 0

    const localPoint = (event: { clientX: number; clientY: number }) => {
      const rect = canvas.getBoundingClientRect()
      return { sx: event.clientX - rect.left, sy: event.clientY - rect.top }
    }

    const snapPointer = (raw: Pt) => {
      const state = useDesignStore.getState()
      const tol = 14 / planCamera.zoom
      const extras = draft.chainOrigin ? [draft.chainOrigin] : []
      const endpoint = endpointSnap(raw, state.walls, extras, tol)
      if (endpoint) return { point: endpoint, label: 'Endpoint' }
      const stepped = gridSnap(raw, planCamera.zoom > 0.12 ? 50 : 100)
      if (draft.wallStart && state.tool === 'wall') {
        const angled = snapAngle(draft.wallStart, stepped)
        if (angled.locked) {
          const degrees = ((angled.degrees % 360) + 360) % 360
          return { point: { x: Math.round(angled.point.x), y: Math.round(angled.point.y) }, label: `${degrees}°` }
        }
      }
      return { point: stepped, label: 'Grid' }
    }

    const refreshGhost = (raw: Pt) => {
      const state = useDesignStore.getState()
      const snapped = snapPointer(raw)
      draft.snapPoint = state.tool === 'select' ? null : snapped.point
      draft.snapLabel = state.tool === 'select' ? '—' : snapped.label
      draft.ghostItem = null
      draft.ghostOpening = null
      draft.ghostFixture = null
      if (state.tool === 'place' && state.activeSku) {
        const spec = catalogBySku[state.activeSku]
        if (!spec) return
        const pose = suggestPlacement(snapped.point, spec, state.walls, state.items, state.fixtures, state.openings)
        if (!pose) return
        draft.ghostItem = {
          id: 'ghost',
          sku: spec.sku,
          x: pose.x ?? snapped.point.x,
          y: pose.y ?? snapped.point.y,
          rotation: pose.rotation ?? 0,
          width: spec.width,
          height: spec.height,
          depth: spec.depth,
          wallId: pose.wallId,
          handing: 'left',
          elevation: pose.elevation ?? spec.elevation,
          hostId: pose.hostId,
        }
      }
      if (state.tool === 'door' || state.tool === 'window' || state.tool === 'niche') {
        const near = nearestWall(raw, state.walls)
        const preset = OPENING_PRESETS[state.tool]
        if (near && near.distance < 280) {
          draft.ghostOpening = {
            id: 'ghost',
            wallId: near.wall.id,
            offset: near.offset,
            flip: false,
            ...preset,
          }
          draft.snapLabel = 'On wall'
        }
      }
      if (state.tool === 'pillar' || state.tool === 'beam' || state.tool === 'chimney' || state.tool === 'pipe') {
        const near = nearestWall(raw, state.walls)
        if (near && near.distance < 500) {
          const size = state.tool === 'pillar' ? [300, 300] : state.tool === 'chimney' ? [640, 440] : state.tool === 'pipe' ? [90, 90] : [1200, near.wall.thickness]
          const pose = poseOnWall(raw, size[0], state.tool === 'beam' ? 0 : size[1], near.wall, state.walls)
          draft.ghostFixture = {
            id: 'ghost',
            type: state.tool,
            x: state.tool === 'beam' ? lerpPoint(near.wall.a, near.wall.b, near.t).x : pose.x,
            y: state.tool === 'beam' ? lerpPoint(near.wall.a, near.wall.b, near.t).y : pose.y,
            width: size[0],
            depth: state.tool === 'beam' ? near.wall.thickness : size[1],
            rotation: pose.rotation,
            wallId: near.wall.id,
          }
          draft.snapLabel = 'On wall'
        }
      }
      useHudStore.getState().setCursor(snapped.point, draft.snapLabel)
    }

    const onMove = (event: PointerEvent) => {
      const { sx, sy } = localPoint(event)
      const raw = screenToWorld(sx, sy)
      if (draft.pan) {
        planCamera.x = draft.pan.cx - (sx - draft.pan.sx) / planCamera.zoom
        planCamera.y = draft.pan.cy - (sy - draft.pan.sy) / planCamera.zoom
        return
      }
      const state = useDesignStore.getState()
      if (draft.dragEnd) {
        const snapped = snapPointer(raw).point
        draft.walls = state.walls.map((wall) => (wall.id === draft.dragEnd?.id ? { ...wall, [draft.dragEnd.end]: snapped } : wall))
        draft.snapLabel = 'Endpoint'
        return
      }
      if (draft.dragHandle) {
        const item = state.items.find((entry) => entry.id === draft.dragHandle?.id)
        const spec = item ? catalogBySku[item.sku] : undefined
        if (item && spec && draft.dragHandle) {
          const along = { x: Math.cos(draft.dragHandle.rotation), y: Math.sin(draft.dragHandle.rotation) }
          const rel = { x: raw.x - draft.dragHandle.anchor.x, y: raw.y - draft.dragHandle.anchor.y }
          const projected = rel.x * along.x + rel.y * along.y
          let width = clamp(Math.round(Math.abs(projected) / 10) * 10, spec.minW, spec.maxW)
          if (projected * draft.dragHandle.edge < 0) width = spec.minW
          const center = add(draft.dragHandle.anchor, mul(along, (draft.dragHandle.edge * width) / 2))
          draft.items = state.items.map((entry) => (entry.id === item.id ? { ...entry, x: center.x, y: center.y, width } : entry))
          draft.snapLabel = `${width} mm`
        }
        return
      }
      if (draft.dragItem) {
        const item = state.items.find((entry) => entry.id === draft.dragItem)
        const spec = item ? catalogBySku[item.sku] : undefined
        if (item && spec) {
          const snapped = snapPointer(raw).point
          const pose = suggestPlacement(snapped, { ...spec, width: item.width, depth: item.depth }, state.walls, state.items.filter((entry) => entry.id !== item.id), state.fixtures, state.openings)
          draft.items = state.items.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  x: pose?.x ?? snapped.x,
                  y: pose?.y ?? snapped.y,
                  rotation: pose?.rotation ?? entry.rotation,
                  wallId: pose?.wallId,
                  hostId: pose?.hostId ?? entry.hostId,
                }
              : entry,
          )
          const moved = draft.items.find((entry) => entry.id === item.id)
          const wall = state.walls.find((entry) => entry.id === moved?.wallId)
          if (moved && wall) {
            const gap = endClearance(moved, wall)
            draft.snapPoint = { x: moved.x, y: moved.y }
            draft.snapLabel = `L ${gap.left} mm · R ${gap.right} mm`
            useHudStore.getState().setCursor(moved, draft.snapLabel)
          }
        }
        return
      }
      refreshGhost(raw)
      if (state.tool === 'select') {
        draft.hover = pickAt(raw, state.walls, state.openings, state.fixtures, state.items)
      } else draft.hover = null
    }

    const onDown = (event: PointerEvent) => {
      if (event.button === 2) {
        draft.wallStart = null
        draft.chainOrigin = null
        return
      }
      const { sx, sy } = localPoint(event)
      const raw = screenToWorld(sx, sy)
      const state = useDesignStore.getState()
      if (event.button === 1 || state.tool === 'pan' || draft.space) {
        draft.pan = { sx, sy, cx: planCamera.x, cy: planCamera.y }
        canvas.setPointerCapture(event.pointerId)
        return
      }
      const snapped = snapPointer(raw)
      if (state.tool === 'wall') {
        if (!draft.wallStart) {
          draft.wallStart = snapped.point
          draft.chainOrigin = snapped.point
          return
        }
        if (dist(draft.wallStart, snapped.point) < 50) return
        const closing = draft.chainOrigin && dist(snapped.point, draft.chainOrigin) < 8
        useDesignStore.getState().addWall({
          id: uid('wall'),
          a: draft.wallStart,
          b: closing && draft.chainOrigin ? draft.chainOrigin : snapped.point,
          thickness: state.defaultThickness,
        })
        if (closing) {
          draft.wallStart = null
          draft.chainOrigin = null
        } else draft.wallStart = snapped.point
        return
      }
      if (state.tool === 'door' || state.tool === 'window' || state.tool === 'niche') {
        const near = nearestWall(raw, state.walls)
        if (!near || near.distance > 280) return
        const preset = OPENING_PRESETS[state.tool]
        const clash = state.openings.some(
          (opening) => opening.wallId === near.wall.id && Math.abs(opening.offset - near.offset) < (opening.width + preset.width) / 2 - 4,
        )
        if (clash) {
          useHudStore.getState().setCursor(snapped.point, 'Overlaps an opening')
          return
        }
        useDesignStore.getState().addOpening({
          id: uid('opening'),
          wallId: near.wall.id,
          offset: near.offset,
          flip: false,
          ...preset,
        })
        return
      }
      if (state.tool === 'pillar' || state.tool === 'beam' || state.tool === 'chimney' || state.tool === 'pipe') {
        if (!draft.ghostFixture) return
        useDesignStore.getState().addFixture({ ...draft.ghostFixture, id: uid('fixture') })
        return
      }
      if (state.tool === 'place' && state.activeSku) {
        const spec = catalogBySku[state.activeSku]
        if (!spec || !draft.ghostItem) return
        useDesignStore.getState().addItem({ ...draft.ghostItem, id: uid('item') })
        return
      }
      const selectedItem = state.selection?.type === 'item' ? state.items.find((item) => item.id === state.selection?.id) : undefined
      if (selectedItem) {
        const edge = handleAt(raw, selectedItem)
        if (edge) {
          const anchor = toWorld({ x: -edge * (selectedItem.width / 2), y: 0 }, selectedItem, selectedItem.rotation)
          draft.dragHandle = { id: selectedItem.id, edge, anchor, rotation: selectedItem.rotation }
          canvas.setPointerCapture(event.pointerId)
          return
        }
      }
      const selectedWall = state.selection?.type === 'wall' ? state.walls.find((wall) => wall.id === state.selection?.id) : undefined
      if (selectedWall) {
        const end = endpointAt(raw, selectedWall)
        if (end) {
          draft.dragEnd = { id: selectedWall.id, end }
          canvas.setPointerCapture(event.pointerId)
          return
        }
      }
      const hit = pickAt(raw, state.walls, state.openings, state.fixtures, state.items)
      useDesignStore.getState().setSelection(hit)
      if (hit?.type === 'item') {
        draft.dragItem = hit.id
        canvas.setPointerCapture(event.pointerId)
      }
    }

    const onUp = () => {
      const state = useDesignStore.getState()
      if (draft.items) state.replaceItems(draft.items)
      if (draft.walls) state.setWalls(draft.walls)
      draft.pan = null
      draft.dragItem = null
      draft.dragHandle = null
      draft.dragEnd = null
      draft.items = null
      draft.walls = null
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { sx, sy } = localPoint(event)
      const world = screenToWorld(sx, sy)
      const next = clamp(planCamera.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08), 0.035, 1.4)
      planCamera.zoom = next
      planCamera.x = world.x - (sx - planCamera.width / 2) / next
      planCamera.y = world.y - (sy - planCamera.height / 2) / next
      useHudStore.getState().setZoom(next)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') draft.space = true
      if (event.key === 'Escape') {
        draft.wallStart = null
        draft.chainOrigin = null
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') draft.space = false
    }

    const loop = () => {
      const rect = wrap.getBoundingClientRect()
      planCamera.width = rect.width
      planCamera.height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const bw = Math.max(1, Math.floor(rect.width * dpr))
      const bh = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      const ctx = canvas.getContext('2d')
      if (ctx && rect.width > 2 && rect.height > 2) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        if (!fitted && rect.width > 40 && rect.height > 40) {
          fitted = true
          fitPlan()
        }
        const state = useDesignStore.getState()
        drawPlan(
          ctx,
          rect.width,
          rect.height,
          planCamera,
          {
            walls: state.walls,
            openings: state.openings,
            fixtures: state.fixtures,
            items: state.items,
            materials: state.materials,
            options: state.options,
            selection: state.selection,
            showDimensions: state.showDimensions,
            defaultThickness: state.defaultThickness,
          },
          {
            snapPoint: draft.snapPoint,
            snapLabel: draft.snapLabel,
            wallStart: draft.wallStart,
            hover: draft.hover,
            ghostItem: draft.ghostItem,
            ghostOpening: draft.ghostOpening,
            ghostFixture: draft.ghostFixture,
            walls: draft.walls,
            items: draft.items,
            defaultThickness: state.defaultThickness,
          },
        )
        useHudStore.getState().setZoom(planCamera.zoom)
      }
      raf = requestAnimationFrame(loop)
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      const { sx, sy } = localPoint(event)
      const raw = screenToWorld(sx, sy)
      const state = useDesignStore.getState()
      const hit = pickAt(raw, state.walls, state.openings, state.fixtures, state.items)
      if (hit) state.setSelection(hit)
      openContextMenu(event.clientX, event.clientY, hit)
    })
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0 bg-canvas">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
    </div>
  )
}

function lerpPoint(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function handleAt(point: Pt, item: PlacedItem): 1 | -1 | null {
  const tol = 12 / planCamera.zoom
  for (const edge of [-1, 1] as const) {
    const handle = toWorld({ x: edge * (item.width / 2), y: 0 }, item, item.rotation)
    if (dist(point, handle) <= tol) return edge
  }
  return null
}

function endpointAt(point: Pt, wall: { a: Pt; b: Pt }): 'a' | 'b' | null {
  const tol = 12 / planCamera.zoom
  if (dist(point, wall.a) <= tol) return 'a'
  if (dist(point, wall.b) <= tol) return 'b'
  return null
}

function pickAt(point: Pt, walls: { id: string; a: Pt; b: Pt; thickness: number }[], openings: Opening[], fixtures: { id: string; x: number; y: number; width: number; depth: number; rotation: number }[], items: PlacedItem[]): Selection | null {
  for (const item of [...items].reverse()) {
    if (catalogBySku[item.sku]?.mount === 'inset') continue
    if (hitItem(point, item)) return { type: 'item', id: item.id }
  }
  for (const opening of openings) {
    const wall = walls.find((entry) => entry.id === opening.wallId)
    if (wall && pointInPoly(point, openingQuad(wall, opening.offset, opening.width))) return { type: 'opening', id: opening.id }
  }
  for (const fixture of fixtures) {
    if (hitItem(point, { ...fixture, sku: '', height: 0, handing: 'left', elevation: 0 })) return { type: 'fixture', id: fixture.id }
  }
  let best: string | null = null
  let bestD = Infinity
  for (const wall of walls) {
    const proj = projectPointToSegment(point, wall.a, wall.b)
    const limit = wall.thickness / 2 + 30
    if (proj.distance <= limit && proj.distance < bestD) {
      best = wall.id
      bestD = proj.distance
    }
  }
  return best ? { type: 'wall', id: best } : null
}
