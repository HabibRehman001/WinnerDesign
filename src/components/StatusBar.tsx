import { useMemo } from 'react'
import { orderedLoop } from '../lib/geometry'
import { buildQuote, money } from '../lib/pricing'
import { canSeeCost } from '../store/useOfficeStore'
import { scaleDenom, useHudStore } from '../plan/camera'
import { useCatalogStore } from '../store/useCatalogStore'
import { useDesignStore } from '../store/useDesignStore'

export function StatusBar() {
  const x = useHudStore((state) => state.x)
  const y = useHudStore((state) => state.y)
  const snap = useHudStore((state) => state.snap)
  const zoom = useHudStore((state) => state.zoom)
  const tool = useDesignStore((state) => state.tool)
  const items = useDesignStore((state) => state.items)
  const walls = useDesignStore((state) => state.walls)
  const openings = useDesignStore((state) => state.openings)
  const materials = useDesignStore((state) => state.materials)
  const options = useDesignStore((state) => state.options)
  const catalogRevision = useCatalogStore((state) => state.revision)
  const priceGroups = useCatalogStore((state) => state.groups())
  const groupMult = priceGroups[Math.min(7, Math.max(0, options.priceGroup - 1))] ?? 1
  const quote = useMemo(
    () => buildQuote({ items, walls, openings, materials, options, groupMult, priceOf: (sku, fallback) => useCatalogStore.getState().priceFor(sku, fallback) }),
    [items, walls, openings, materials, options, groupMult, catalogRevision],
  )
  const closed = orderedLoop(walls) !== null
  const scale = scaleDenom(zoom)

  return (
    <footer className="flex h-8 items-center gap-4 border-t border-white/10 bg-shell-deep px-3 text-[11px] text-white/70">
      <span className="uppercase tracking-wider text-white">{tool}</span>
      <span className="tabular">
        X {x == null ? '—' : x.toLocaleString('en-GB')} · Y {y == null ? '—' : y.toLocaleString('en-GB')}
      </span>
      <span className="text-snap">{snap}</span>
      <span className="tabular">Zoom {Math.round((zoom / 0.16) * 100)}%</span>
      <span className="tabular">Scale 1:{scale}</span>
      <span>{closed ? 'Closed room' : 'Open plan'}</span>
      <span>
        {quote.counts.cabinets} cabinets · {quote.counts.doors} doors · {quote.counts.worktopM2.toFixed(2)} m²
      </span>
      <button className="ml-auto font-semibold text-[#7ec8ff]" onClick={() => useDesignStore.getState().setInspectorTab('quote')}>
        {canSeeCost() ? `${money(quote.gross, options.currency)} incl. VAT` : 'Quote'}
      </button>
    </footer>
  )
}
