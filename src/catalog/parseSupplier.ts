import type { CatalogItem, CategoryId, CurrencyCode, Mount, UnitStyle } from '../types'

const CATEGORIES = new Set<CategoryId>(['base', 'wall', 'tall', 'worktop', 'trim', 'appliance', 'sanitary'])
const MOUNTS = new Set<Mount>(['floor', 'wall', 'inset', 'housing'])
const STYLES = new Set<UnitStyle>([
  'standard',
  'drawer',
  'sink',
  'corner',
  'carousel',
  'flap',
  'glass',
  'pantry',
  'oven-tower',
  'fridge',
  'hob',
  'hood',
  'oven',
  'dishwasher',
  'sink-bowl',
  'tap',
  'basin',
  'wc',
  'bath',
  'fridge-app',
])

export interface SupplierCatalog {
  id: string
  name: string
  currency: CurrencyCode
  priceGroups: number[]
  discount: number
  margin: number
  items: CatalogItem[]
}

function numberOf(value: unknown, fallback: number) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function textOf(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function parseItem(value: unknown, index: number): CatalogItem {
  if (!value || typeof value !== 'object') throw new Error(`Item ${index + 1} is not an object`)
  const row = value as Record<string, unknown>
  const width = numberOf(row.width, 600)
  const height = numberOf(row.height, 870)
  const depth = numberOf(row.depth, 560)
  const category = CATEGORIES.has(row.category as CategoryId) ? (row.category as CategoryId) : 'base'
  const mount = MOUNTS.has(row.mount as Mount) ? (row.mount as Mount) : 'floor'
  const style = STYLES.has(row.style as UnitStyle) ? (row.style as UnitStyle) : 'standard'
  return {
    kind: 'placeable',
    sku: textOf(row.sku, `CUSTOM-${index + 1}`),
    name: textOf(row.name, `Custom unit ${index + 1}`),
    category,
    group: textOf(row.group, 'Imported'),
    style,
    mount,
    width,
    height,
    depth,
    minW: numberOf(row.minW, Math.min(width, 150)),
    maxW: numberOf(row.maxW, Math.max(width, 1200)),
    minH: numberOf(row.minH, Math.min(height, 200)),
    maxH: numberOf(row.maxH, Math.max(height, 2400)),
    minD: numberOf(row.minD, Math.min(depth, 200)),
    maxD: numberOf(row.maxD, Math.max(depth, 1200)),
    price: numberOf(row.price, 0),
    doorCount: numberOf(row.doorCount, style === 'drawer' ? 0 : 1),
    drawerCount: numberOf(row.drawerCount, style === 'drawer' ? 3 : 0),
    elevation: numberOf(row.elevation, mount === 'wall' ? 1400 : 0),
  }
}

export function parseSupplier(data: unknown): SupplierCatalog {
  if (!data || typeof data !== 'object') throw new Error('Catalog must be a JSON object')
  const record = data as Record<string, unknown>
  if (!Array.isArray(record.items) || record.items.length === 0) throw new Error('Catalog needs an items array')
  const groups = Array.isArray(record.priceGroups) ? record.priceGroups.map((value) => numberOf(value, 1)).slice(0, 8) : []
  while (groups.length < 8) groups.push(1 + groups.length * 0.08)
  const currency = record.currency === 'EUR' || record.currency === 'USD' || record.currency === 'GBP' ? record.currency : 'GBP'
  const name = textOf(record.name ?? record.supplier, 'Imported supplier')
  return {
    id: textOf(record.id, `supplier-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
    name,
    currency,
    priceGroups: groups,
    discount: numberOf(record.discount, 0),
    margin: numberOf(record.margin, 0),
    items: record.items.map(parseItem),
  }
}
