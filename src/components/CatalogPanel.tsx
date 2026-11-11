import { useMemo, useRef, useState } from 'react'
import { CATEGORIES } from '../catalog'
import { parseSupplier } from '../catalog/parseSupplier'
import { money } from '../lib/pricing'
import { canSeeCost } from '../store/useOfficeStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { useDesignStore } from '../store/useDesignStore'
import type { LibraryEntry } from '../types'

export function CatalogPanel({ width }: { width: number }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const activeSku = useDesignStore((state) => state.activeSku)
  const materials = useDesignStore((state) => state.materials)
  const options = useDesignStore((state) => state.options)
  const catalogs = useCatalogStore((state) => state.catalogs)
  const activeId = useCatalogStore((state) => state.activeId)
  const activeVersion = useCatalogStore((state) => state.activeVersion)
  const revision = useCatalogStore((state) => state.revision)
  const [priceNote, setPriceNote] = useState('')
  const visible = catalogs.filter((catalog) => !catalog.hidden)
  const needle = query.trim().toLowerCase()

  const tree = useMemo(() => {
    const library = useCatalogStore.getState().entries()
    return CATEGORIES.map((category) => {
      const entries = library.filter((entry) => entry.category === category.id).filter((entry) => {
        if (!needle) return true
        return `${entry.name} ${entry.sku} ${entry.group}`.toLowerCase().includes(needle)
      })
      const groups = new Map<string, LibraryEntry[]>()
      for (const entry of entries) {
        const list = groups.get(entry.group) ?? []
        list.push(entry)
        groups.set(entry.group, list)
      }
      return { ...category, groups: [...groups.entries()] }
    }).filter((category) => category.groups.length)
  }, [needle, revision])

  return (
    <aside className="flex min-w-40 shrink flex-col border-r border-white/10 bg-shell" style={{ width, flexBasis: width }}>
      <div className="border-b border-white/10 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Catalog</div>
          <button className="text-[10px] uppercase tracking-wider text-[#7ec8ff]" onClick={() => fileRef.current?.click()}>
            Import
          </button>
        </div>
        <select
          value={`${activeId}@${activeVersion}`}
          onChange={(event) => {
            const catalog = visible.find((entry) => `${entry.id}@${entry.version}` === event.target.value)
            if (!catalog) return
            useCatalogStore.getState().select(catalog.id, catalog.version)
            if (catalog.id !== 'winner-core') {
              useDesignStore.getState().patchOptions({ currency: catalog.currency, discount: catalog.discount, margin: catalog.margin })
            }
          }}
          className="mt-2 w-full rounded border border-white/10 bg-shell-deep px-2 py-1.5 text-sm outline-none"
        >
          {visible.map((catalog) => (
            <option key={`${catalog.id}@${catalog.version}`} value={`${catalog.id}@${catalog.version}`}>
              {catalog.name} v{catalog.version}
            </option>
          ))}
        </select>
        <button
          className="mt-2 w-full rounded bg-white/10 py-1 text-[10px] uppercase tracking-wider"
          onClick={() => {
            const skus = useDesignStore.getState().items.map((item) => item.sku)
            const report = useCatalogStore.getState().applyPrices(skus)
            const missing = report.missing.length ? ` Still drawn, not in this catalogue: ${report.missing.join(', ')}.` : ''
            setPriceNote(`Prices now use ${report.name} v${report.version}. Drawn sizes were left unchanged.${missing}`)
          }}
        >
          Apply catalogue prices
        </button>
        {priceNote && <p className="mt-2 text-[11px] leading-relaxed text-white/55">{priceNote}</p>}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              try {
                const catalog = parseSupplier(JSON.parse(String(reader.result)))
                useCatalogStore.getState().importJson(catalog)
                useDesignStore.getState().patchOptions({ currency: catalog.currency, discount: catalog.discount, margin: catalog.margin })
              } catch (error) {
                window.alert(error instanceof Error ? error.message : 'That catalog file could not be read.')
              }
            }
            reader.readAsText(file)
          }}
        />
        <input
          id="catalog-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search modules, SKU"
          className="mt-2 w-full rounded border border-white/10 bg-shell-deep px-2 py-1.5 text-sm outline-none focus:border-winner"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {tree.length === 0 && <div className="px-2 py-6 text-sm text-white/40">No modules match.</div>}
        {tree.map((category) => {
          const expanded = open[category.id] !== false
          return (
            <section key={category.id} className="mb-2">
              <button
                className="flex w-full items-center justify-between px-1 py-1 text-left text-[12px] font-semibold uppercase tracking-wider text-white"
                onClick={() => setOpen((state) => ({ ...state, [category.id]: !expanded }))}
              >
                <span>{category.label}</span>
                <span className="text-white/40">{expanded ? '−' : '+'}</span>
              </button>
              {expanded &&
                category.groups.map(([group, entries]) => (
                  <div key={group} className="mb-2 ml-1">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-snap/80">{group}</div>
                    {entries.map((entry) => {
                      const selected = entry.kind === 'placeable' ? activeSku === entry.sku : isActive(entry, materials, options)
                      return (
                        <button
                          key={entry.sku}
                          onClick={() => {
                            if (entry.kind === 'placeable') useDesignStore.getState().setActiveSku(entry.sku)
                            else useDesignStore.getState().applySystem(entry)
                          }}
                          className={`mb-0.5 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[13px] ${selected ? 'bg-winner text-white' : 'text-white/80 hover:bg-white/10'}`}
                        >
                          <span>
                            <span className="block leading-tight">{entry.name}</span>
                            <span className={`block text-[10px] ${selected ? 'text-white/70' : 'text-white/35'}`}>{entry.sku}</span>
                          </span>
                          {entry.kind === 'placeable' && canSeeCost() && <span className="tabular text-[11px]">{money(entry.price, options.currency)}</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
            </section>
          )
        })}
      </div>
      <CustomItemForm />
    </aside>
  )
}

function CustomItemForm() {
  const [sku, setSku] = useState('CUSTOM-1')
  const [name, setName] = useState('Custom unit')
  const [price, setPrice] = useState(100)
  return (
    <form
      className="space-y-1 border-t border-white/10 p-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault()
        useCatalogStore.getState().addCustom({
          kind: 'placeable',
          sku,
          name,
          category: 'base',
          group: 'Custom',
          style: 'standard',
          mount: 'floor',
          width: 600,
          height: 870,
          depth: 560,
          minW: 300,
          maxW: 1200,
          minH: 700,
          maxH: 960,
          minD: 300,
          maxD: 650,
          price,
          doorCount: 1,
          drawerCount: 0,
          elevation: 0,
        })
      }}
    >
      <div className="uppercase tracking-wider text-white/40">Shop item</div>
      <input value={sku} onChange={(event) => setSku(event.target.value)} className="w-full rounded border border-white/10 bg-shell-deep px-2 py-1" />
      <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded border border-white/10 bg-shell-deep px-2 py-1" />
      <input value={price} type="number" min={0} onChange={(event) => setPrice(Number(event.target.value))} className="w-full rounded border border-white/10 bg-shell-deep px-2 py-1" />
      <button className="w-full rounded bg-white/10 py-1" type="submit">Save to shop catalogue</button>
    </form>
  )
}

function isActive(
  entry: Extract<LibraryEntry, { kind: 'system' }>,
  materials: { worktop: string },
  options: { edgeProfile: string; autoWorktop: boolean; autoPlinth: boolean; autoCornice: boolean; splashback: boolean },
) {
  const flag = entry.active
  if (!flag) return false
  if (flag.worktop && materials.worktop !== flag.worktop) return false
  if (flag.edgeProfile && options.edgeProfile !== flag.edgeProfile) return false
  if (flag.autoPlinth != null && options.autoPlinth !== flag.autoPlinth) return false
  if (flag.autoCornice != null && options.autoCornice !== flag.autoCornice) return false
  if (flag.splashback != null && options.splashback !== flag.splashback) return false
  if (flag.autoWorktop != null && options.autoWorktop !== flag.autoWorktop && !flag.worktop) return false
  return true
}
