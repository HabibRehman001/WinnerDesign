import { create } from 'zustand'
import { boundsOf } from '../lib/geometry'
import type { Pt, Wall } from '../types'
import { useDesignStore } from '../store/useDesignStore'

export const planCamera = {
  x: 2100,
  y: 1650,
  zoom: 0.16,
  width: 800,
  height: 600,
}

export function scaleDenom(zoom: number) {
  const screenMmPerWorldMm = zoom * (25.4 / 96)
  if (screenMmPerWorldMm <= 0) return 1
  return Math.max(1, Math.round(1 / screenMmPerWorldMm))
}

interface HudState {
  x: number | null
  y: number | null
  snap: string
  zoom: number
  setCursor: (point: Pt | null, snap: string) => void
  setZoom: (zoom: number) => void
}

export const useHudStore = create<HudState>((set, get) => ({
  x: null,
  y: null,
  snap: '—',
  zoom: planCamera.zoom,
  setCursor: (point, snap) => {
    const x = point ? Math.round(point.x) : null
    const y = point ? Math.round(point.y) : null
    const current = get()
    if (current.x === x && current.y === y && current.snap === snap) return
    set({ x, y, snap })
  },
  setZoom: (zoom) => {
    const rounded = Math.round(zoom * 1000) / 1000
    if (get().zoom === rounded) return
    set({ zoom: rounded })
  },
}))

export function frameCamera(walls: Wall[], width: number, height: number) {
  const items = useDesignStore.getState().items
  const bounds = boundsOf(walls, items)
  const pad = 1100
  const minX = bounds.minX - pad
  const minY = bounds.minY - pad
  const maxX = bounds.maxX + pad
  const maxY = bounds.maxY + pad
  const zoom = Math.max(0.04, Math.min(width / (maxX - minX || 1), height / (maxY - minY || 1)))
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom }
}

export function fitPlan() {
  const { walls } = useDesignStore.getState()
  if (planCamera.width < 40 || planCamera.height < 40) return
  const frame = frameCamera(walls, planCamera.width, planCamera.height)
  planCamera.x = frame.x
  planCamera.y = frame.y
  planCamera.zoom = frame.zoom
  useHudStore.getState().setZoom(planCamera.zoom)
}

export function zoomPlan(factor: number) {
  planCamera.zoom = Math.min(1.4, Math.max(0.035, planCamera.zoom * factor))
  useHudStore.getState().setZoom(planCamera.zoom)
}

export function screenToWorld(sx: number, sy: number): Pt {
  return {
    x: (sx - planCamera.width / 2) / planCamera.zoom + planCamera.x,
    y: (sy - planCamera.height / 2) / planCamera.zoom + planCamera.y,
  }
}

export function worldToScreen(point: Pt): Pt {
  return {
    x: (point.x - planCamera.x) * planCamera.zoom + planCamera.width / 2,
    y: (point.y - planCamera.y) * planCamera.zoom + planCamera.height / 2,
  }
}
