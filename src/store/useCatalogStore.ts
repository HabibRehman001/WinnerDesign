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
  }
}

interface CatalogState {
  catalogs: SupplierCatalog[]
  activeId: string
  revision: number
  active: () => SupplierCatalog
  entries: () => LibraryEntry[]
  priceFor: (sku: string, fallback: number) => number
  groups: () => number[]
  select: (id: string) => void
  importJson: (data: unknown) => SupplierCatalog
  remove: (id: string) => void
  addCustom: (item: CatalogItem) => void
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

export const useCatalogStore = create<CatalogState>((set, get) => ({
  catalogs: [builtinCatalog(), ...stored.filter((catalog) => catalog.id !== BUILTIN_CATALOG)],
  activeId: BUILTIN_CATALOG,
  revision: 0,
  active: () => get().catalogs.find((catalog) => catalog.id === get().activeId) ?? get().catalogs[0],
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
  select: (id) => {
    const catalog = get().catalogs.find((entry) => entry.id === id)
    if (!catalog) return
    resetCatalogGeometry(catalog.id === BUILTIN_CATALOG ? null : catalog.items)
    set({ activeId: id, revision: get().revision + 1 })
  },
  importJson: (data) => {
    const catalog = parseSupplier(data)
    const catalogs = [...get().catalogs.filter((entry) => entry.id !== catalog.id), catalog]
    persist(catalogs)
    resetCatalogGeometry(catalog.items)
    set({ catalogs, activeId: catalog.id, revision: get().revision + 1 })
    return catalog
  },
  remove: (id) => {
    if (id === BUILTIN_CATALOG) return
    const catalogs = get().catalogs.filter((entry) => entry.id !== id)
    persist(catalogs)
    const activeId = get().activeId === id ? BUILTIN_CATALOG : get().activeId
    resetCatalogGeometry(activeId === BUILTIN_CATALOG ? null : catalogs.find((entry) => entry.id === activeId)?.items ?? null)
    set({ catalogs, activeId, revision: get().revision + 1 })
  },
  addCustom: (item) => {
    let catalogs = get().catalogs
    let activeId = get().activeId
    if (activeId === BUILTIN_CATALOG) {
      const existing = catalogs.find((entry) => entry.id === 'shop-custom')
      const shop: SupplierCatalog = existing ?? {
        id: 'shop-custom',
        name: 'Shop catalogue',
        currency: 'GBP',
        priceGroups: DEFAULT_GROUPS,
        discount: 0,
        margin: 0,
        items: [],
      }
      catalogs = [...catalogs.filter((entry) => entry.id !== shop.id), shop]
      activeId = shop.id
    }
    const current = catalogs.find((entry) => entry.id === activeId) ?? catalogs[0]
    const next = { ...current, items: [...current.items.filter((entry) => entry.sku !== item.sku), item] }
    catalogs = catalogs.map((entry) => (entry.id === next.id ? next : entry))
    persist(catalogs)
    resetCatalogGeometry(next.items)
    set({ catalogs, activeId, revision: get().revision + 1 })
  },
}))
