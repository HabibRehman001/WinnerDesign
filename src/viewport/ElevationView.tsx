import { useEffect, useMemo, useRef, useState } from 'react'
import { catalogBySku } from '../catalog'
import { elevationDimensions } from '../lib/dimensions'
import { formatMm, wallLength } from '../lib/geometry'
import { buildRuns, unitInterval } from '../lib/runs'
import { useDesignStore } from '../store/useDesignStore'

export function ElevationView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const walls = useDesignStore((state) => state.walls)
  const openings = useDesignStore((state) => state.openings)
  const items = useDesignStore((state) => state.items)
  const options = useDesignStore((state) => state.options)
  const materials = useDesignStore((state) => state.materials)
  const selection = useDesignStore((state) => state.selection)
  const showDimensions = useDesignStore((state) => state.showDimensions)
  const wallId = selection?.type === 'wall' ? selection.id : walls[0]?.id
  const wall = walls.find((entry) => entry.id === wallId) ?? walls[0]
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const model = useMemo(() => {
    if (!wall) return null
    const length = wallLength(wall)
    const faces = items.filter((item) => item.wallId === wall.id && catalogBySku[item.sku]?.mount !== 'inset')
    return { length, faces }
  }, [wall, items])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect()
      setSize({ w: rect.width, h: rect.height })
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [wall])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !wall || !model || size.w < 10) return
    const rect = wrap.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const width = rect.width
    const height = rect.height
    ctx.fillStyle = '#F5F6F8'
    ctx.fillRect(0, 0, width, height)
    const ceiling = options.ceiling
    const frame = elevationFrame(width, height, model.length, ceiling, showDimensions)
    const { scale, originX, floorY } = frame
    const toX = (along: number) => originX + along * scale
    const toY = (elev: number) => floorY - elev * scale

    ctx.fillStyle = materials.wallPaint
    ctx.fillRect(toX(0), toY(ceiling), model.length * scale, ceiling * scale)
    ctx.strokeStyle = '#8E949E'
    ctx.strokeRect(toX(0), toY(ceiling), model.length * scale, ceiling * scale)

    ctx.setLineDash([4, 4])
    ctx.strokeStyle = '#00E5FF'
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(1400))
    ctx.lineTo(toX(model.length), toY(1400))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#0066CC'
    ctx.font = '600 11px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Hanging rail 1,400 mm', toX(12), toY(1400) - 6)

    for (const opening of openings.filter((entry) => entry.wallId === wall.id)) {
      const x = toX(opening.offset - opening.width / 2)
      const y = toY(opening.sill + opening.height)
      ctx.fillStyle = opening.type === 'window' ? '#d5ebf8' : '#F5F6F8'
      ctx.fillRect(x, y, opening.width * scale, opening.height * scale)
      ctx.strokeStyle = '#1A1D20'
      ctx.strokeRect(x, y, opening.width * scale, opening.height * scale)
      if (showDimensions) label(ctx, x + (opening.width * scale) / 2, y - 12, formatMm(opening.width), false)
    }

    const runs = buildRuns(items, [wall], 'base')
    if (options.autoWorktop) {
      for (const run of runs) {
        ctx.fillStyle = materials.worktopColor
        ctx.fillRect(toX(run.t0), toY(run.height + options.worktopThickness), (run.t1 - run.t0) * scale, options.worktopThickness * scale)
      }
    }
    if (options.splashback) {
      for (const run of runs) {
        const x = toX(run.t0)
        const y = toY(run.height + options.worktopThickness + options.splashHeight)
        const w = (run.t1 - run.t0) * scale
        const h = options.splashHeight * scale
        drawTileGrid(ctx, x, y, w, h, materials.splashTile, materials.splashGrout, materials.splashTileSize * scale, materials.splashTileAngle)
      }
    }
    if (options.autoPlinth) {
      for (const run of runs) {
        ctx.fillStyle = '#2C3036'
        ctx.fillRect(toX(run.t0), toY(options.plinthHeight), (run.t1 - run.t0) * scale, options.plinthHeight * scale)
      }
    }

    for (const item of model.faces) {
      const spec = catalogBySku[item.sku]
      if (!spec) continue
      const span = unitInterval(item, wall)
      const x = toX(span.t0)
      const y = toY(item.elevation + item.height)
      const selected = selection?.type === 'item' && selection.id === item.id
      ctx.fillStyle = spec.category === 'wall' ? '#EEF3F8' : spec.category === 'appliance' ? '#C5CED6' : materials.doorColor
      ctx.globalAlpha = spec.category === 'wall' ? 0.92 : 1
      ctx.fillRect(x, y, item.width * scale, item.height * scale)
      ctx.globalAlpha = 1
      ctx.lineWidth = selected ? 2 : 1
      ctx.strokeStyle = selected ? '#FF6600' : '#314052'
      ctx.strokeRect(x, y, item.width * scale, item.height * scale)
      if (item.width * scale > 36) {
        ctx.fillStyle = '#1A1D20'
        ctx.font = '600 11px "Segoe UI", Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(spec.sku, x + (item.width * scale) / 2, y + (item.height * scale) / 2)
      }
    }

    if (showDimensions) {
      const activeId = selection?.type === 'dimension' && selection.wallId === wall.id ? selection.id : ''
      for (const dim of elevationDimensions(wall, items, options.dimensionAlign)) {
        const y = dimensionY(floorY, dim.drop, scale)
        const x0 = toX(dim.t0)
        const x1 = toX(dim.t1)
        ctx.strokeStyle = dim.selectId === activeId ? '#FF6600' : '#5C6570'
        ctx.lineWidth = dim.selectId === activeId ? 1.6 : 1
        ctx.beginPath()
        ctx.moveTo(x0, floorY)
        ctx.lineTo(x0, y)
        ctx.moveTo(x1, floorY)
        ctx.lineTo(x1, y)
        ctx.moveTo(x0, y)
        ctx.lineTo(x1, y)
        ctx.stroke()
        if (dim.gap && dim.length < 80) continue
        const text = formatMm(dim.length)
        ctx.font = '600 11px "Segoe UI", Inter, sans-serif'
        if (Math.abs(x1 - x0) >= ctx.measureText(text).width + 4) label(ctx, (x0 + x1) / 2, y, text, dim.gap)
      }
    }

    ctx.fillStyle = '#1A1D20'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = '600 12px "Segoe UI", Inter, sans-serif'
    ctx.fillText(`Elevation · ${formatMm(model.length)}`, 16, 14)
  }, [wall, walls, model, openings, items, options, materials, selection, showDimensions, size])

  if (!wall) {
    return <div className="grid h-full place-items-center text-sm text-[#5c6570]">Draw a wall to open an elevation.</div>
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-canvas">
      <div className="flex items-center gap-2 border-b border-[#d7dbe2] bg-white px-3 py-1.5 text-xs text-ink">
        <span className="uppercase tracking-wider text-[#5c6570]">Wall</span>
        <select
          className="rounded border border-[#d0d4dc] bg-white px-2 py-1"
          value={wall.id}
          onChange={(event) => useDesignStore.getState().setSelection({ type: 'wall', id: event.target.value })}
        >
          {walls.map((entry, index) => (
            <option key={entry.id} value={entry.id}>
              Wall {index + 1} — {formatMm(wallLength(entry))}
            </option>
          ))}
        </select>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onPointerDown={(event) => {
            if (!wall || !wrapRef.current) return
            const rect = wrapRef.current.getBoundingClientRect()
            const frame = elevationFrame(rect.width, rect.height, wallLength(wall), options.ceiling, showDimensions)
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top
            const along = (x - frame.originX) / frame.scale
            const elev = (frame.floorY - y) / frame.scale
            if (showDimensions) {
              const dim = elevationDimensions(wall, items, options.dimensionAlign).find((entry) => {
                const line = dimensionY(frame.floorY, entry.drop, frame.scale)
                return Math.abs(y - line) < 14 && along >= entry.t0 - 40 && along <= entry.t1 + 40
              })
              if (dim) {
                useDesignStore.getState().setSelection({ type: 'dimension', id: dim.selectId, wallId: wall.id, kind: dim.kind })
                return
              }
            }
            const hit = items.find((item) => {
              if (item.wallId !== wall.id) return false
              const span = unitInterval(item, wall)
              return along >= span.t0 && along <= span.t1 && elev >= item.elevation && elev <= item.elevation + item.height
            })
            useDesignStore.getState().setSelection(hit ? { type: 'item', id: hit.id } : { type: 'wall', id: wall.id })
          }}
        />
      </div>
    </div>
  )
}

function dimensionY(floorY: number, drop: number, scale: number) {
  return floorY + drop * Math.max(scale, 0.18)
}

function elevationFrame(width: number, height: number, length: number, ceiling: number, showDimensions: boolean) {
  const marginX = 48
  const marginTop = 40
  const marginBottom = showDimensions ? 112 : 48
  const scale = Math.min((width - marginX * 2) / Math.max(length, 1), (height - marginTop - marginBottom) / Math.max(ceiling, 1))
  return {
    scale,
    originX: (width - length * scale) / 2,
    floorY: height - marginBottom,
  }
}

function drawTileGrid(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, tile: string, grout: string, tilePx: number, angle: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  ctx.fillStyle = grout
  ctx.fillRect(x, y, width, height)
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  const size = Math.max(8, tilePx)
  const span = Math.hypot(width, height) + size
  ctx.fillStyle = tile
  for (let row = -span; row < span; row += size) {
    for (let col = -span; col < span; col += size) {
      ctx.fillRect(col + 1, row + 1, size - 2, size - 2)
    }
  }
  ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, gap: boolean) {
  ctx.font = '600 11px "Segoe UI", Inter, sans-serif'
  const w = ctx.measureText(text).width + 12
  ctx.fillStyle = gap ? '#FF6600' : '#FFFFFF'
  ctx.fillRect(x - w / 2, y - 9, w, 18)
  ctx.strokeStyle = gap ? '#FF6600' : '#8B909A'
  ctx.strokeRect(x - w / 2, y - 9, w, 18)
  ctx.fillStyle = gap ? '#FFFFFF' : '#1A1D20'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 1)
}
