import { create } from 'zustand'
import { LIBRARY, resetCatalogGeometry } from '../catalog'
import { parseSupplier, type SupplierCatalog } from '../catalog/parseSupplier'
import type { CatalogItem, LibraryEntry } from '../types'

const STORAGE_KEY = 'winner-design-catalogs-v1'
export const BUILTIN_CATALOG = 'winner-core'

const DEFAULT_GROUPS = [1, 1.08, 1.16, 1.25, 1.36, 1.48, 1.62, 1.8]

function builtinItems() {
  return LIBRARY.filter((entry): entry is CatalogItem => entry.kind === 'placeable')
}

function builtinCatalog(): SupplierCatalog {
  return {
    id: BUILTIN_CATALOG,
    name: 'Winner Core',
    currency: 'GBP',
    priceGroups: DEFAULT_GROUPS,
    discount: 0,
    margin: 0,
    items: builtinItems(),
    version: 1,
    hidden: false,
  }
}

interface CatalogState {
  catalogs: SupplierCatalog[]
  activeId: string
  activeVersion: number
  revision: number
  active: () => SupplierCatalog
  entries: () => LibraryEntry[]
  priceFor: (sku: string, fallback: number) => number
  groups: () => number[]
  select: (id: string, version: number) => void
  importJson: (data: unknown) => SupplierCatalog
  remove: (id: string) => void
  addCustom: (item: CatalogItem) => void
  applyPrices: (skus: string[]) => { name: string; version: number; missing: string[] }
}

function readStored(): SupplierCatalog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown[]
    if (!Array.isArray(data)) return []
    return data.flatMap((entry) => {
      try {
        return [parseSupplier(entry)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

function persist(catalogs: SupplierCatalog[]) {
  const extra = catalogs.filter((catalog) => catalog.id !== BUILTIN_CATALOG)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(extra))
}

const stored = readStored()

function catalogKey(catalog: { id: string; version: number }) {
  return `${catalog.id}@${catalog.version}`
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  catalogs: [builtinCatalog(), ...stored.filter((catalog) => catalog.id !== BUILTIN_CATALOG)],
  activeId: BUILTIN_CATALOG,
  activeVersion: 1,
  revision: 0,
  active: () => get().catalogs.find((catalog) => catalog.id === get().activeId && catalog.version === get().activeVersion) ?? get().catalogs[0],
  entries: () => {
    const active = get().active()
    const systems = LIBRARY.filter((entry) => entry.kind === 'system')
    if (active.id === BUILTIN_CATALOG) return LIBRARY
    return [...systems, ...active.items]
  },
  priceFor: (sku, fallback) => {
    const active = get().active()
    if (active.id === BUILTIN_CATALOG) return fallback
    return active.items.find((item) => item.sku === sku)?.price ?? fallback
  },
  groups: () => get().active().priceGroups,
  select: (id, version) => {
    const catalog = get().catalogs.find((entry) => entry.id === id && entry.version === version && !entry.hidden)
    if (!catalog) return
    resetCatalogGeometry(catalog.id === BUILTIN_CATALOG ? null : catalog.items)
    set({ activeId: id, activeVersion: version, revision: get().revision + 1 })
  },
  importJson: (data) => {
    const catalog = parseSupplier(data)
    let catalogs = get().catalogs
    const previous = catalogs.filter((entry) => entry.id === catalog.id)
    const newest = previous.reduce((max, entry) => Math.max(max, entry.version), 0)
    if (previous.length > 0 && catalog.version > newest) {
      catalogs = catalogs.map((entry) => (entry.id === catalog.id ? { ...entry, hidden: true } : entry))
      catalogs = [...catalogs, { ...catalog, hidden: false }]
    } else {
      catalogs = [...catalogs.filter((entry) => catalogKey(entry) !== catalogKey(catalog)), catalog]
    }
    persist(catalogs)
    resetCatalogGeometry(catalog.id === BUILTIN_CATALOG ? null : catalog.items)
    set({ catalogs, activeId: catalog.id, activeVersion: catalog.version, revision: get().revision + 1 })
    return catalog
  },
  remove: (id) => {
    if (id === BUILTIN_CATALOG) return
    const version = get().activeId === id ? get().activeVersion : undefined
    let catalogs = get().catalogs.filter((entry) => !(entry.id === id && (version == null || entry.version === version)))
    const siblings = catalogs.filter((entry) => entry.id === id).sort((a, b) => b.version - a.version)
    if (siblings[0]) catalogs = catalogs.map((entry) => (catalogKey(entry) === catalogKey(siblings[0]) ? { ...entry, hidden: false } : entry))
    persist(catalogs)
    const next = get().activeId === id ? (siblings[0] ?? catalogs.find((entry) => entry.id === BUILTIN_CATALOG)!) : get().active()
    resetCatalogGeometry(next.id === BUILTIN_CATALOG ? null : next.items)
    set({ catalogs, activeId: next.id, activeVersion: next.version, revision: get().revision + 1 })
  },
  addCustom: (item) => {
    let catalogs = get().catalogs
    let activeId = get().activeId
    let activeVersion = get().activeVersion
    if (activeId === BUILTIN_CATALOG) {
      const existing = catalogs.find((entry) => entry.id === 'shop-custom' && !entry.hidden)
      const shop: SupplierCatalog = existing ?? {
        id: 'shop-custom',
        name: 'Shop catalogue',
        currency: 'GBP',
        priceGroups: DEFAULT_GROUPS,
        discount: 0,
        margin: 0,
        items: [],
        version: 1,
        hidden: false,
      }
      catalogs = existing ? catalogs : [...catalogs, shop]
      activeId = shop.id
      activeVersion = shop.version
    }
    const current = catalogs.find((entry) => entry.id === activeId && entry.version === activeVersion) ?? catalogs[0]
    const next = { ...current, items: [...current.items.filter((entry) => entry.sku !== item.sku), item] }
    catalogs = catalogs.map((entry) => (catalogKey(entry) === catalogKey(next) ? next : entry))
    persist(catalogs)
    resetCatalogGeometry(next.items)
    set({ catalogs, activeId, activeVersion, revision: get().revision + 1 })
  },
  applyPrices: (skus) => {
    const visible = get().catalogs.filter((entry) => entry.id === get().activeId && !entry.hidden).sort((a, b) => b.version - a.version)
    const catalog = visible[0] ?? get().active()
    if (catalogKey(catalog) !== catalogKey(get().active())) get().select(catalog.id, catalog.version)
    const known = new Set(
      catalog.id === BUILTIN_CATALOG
        ? LIBRARY.flatMap((entry) => (entry.kind === 'placeable' ? [entry.sku] : []))
        : catalog.items.map((item) => item.sku),
    )
    return { name: catalog.name, version: catalog.version, missing: [...new Set(skus.filter((sku) => !known.has(sku)))] }
  },
}))
