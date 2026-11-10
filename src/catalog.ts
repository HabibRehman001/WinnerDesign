import type { CatalogItem, CategoryId, LibraryEntry, SystemEntry, UnitStyle } from './types'

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'base', label: 'Base Units' },
  { id: 'wall', label: 'Wall Units' },
  { id: 'tall', label: 'Tall Units' },
  { id: 'worktop', label: 'Worktops & Splashbacks' },
  { id: 'trim', label: 'Plinths & Cornices' },
  { id: 'appliance', label: 'Appliances' },
  { id: 'sanitary', label: 'Sanitaryware' },
]

const DOOR_PRESETS = {
  'high-gloss': { color: '#F4F7FB', roughness: 0.12, metalness: 0.08, clearcoat: 1, multiplier: 1.35 },
  matte: { color: '#E6E1D6', roughness: 0.9, metalness: 0, clearcoat: 0, multiplier: 1.1 },
  wood: { color: '#8D5A32', roughness: 0.52, metalness: 0, clearcoat: 0, multiplier: 1.28 },
  shaker: { color: '#F6F3EC', roughness: 0.46, metalness: 0, clearcoat: 0, multiplier: 1.18 },
  raised: { color: '#F3EEE4', roughness: 0.42, metalness: 0, clearcoat: 0.15, multiplier: 1.32 },
} as const

export const DOOR_STYLES = DOOR_PRESETS

export const WORKTOPS = {
  granite: { label: 'Granite', color: '#3E4248', price: 285, roughness: 0.32, metalness: 0.08 },
  quartz: { label: 'Quartz', color: '#E4DFD8', price: 240, roughness: 0.22, metalness: 0.04 },
  marble: { label: 'Marble', color: '#F3F1EC', price: 340, roughness: 0.2, metalness: 0.05 },
  wood: { label: 'Solid wood', color: '#A56B3C', price: 165, roughness: 0.55, metalness: 0 },
  steel: { label: 'Stainless steel', color: '#C5CED6', price: 210, roughness: 0.16, metalness: 0.86 },
} as const

export const HANDLES = {
  bar: { label: 'Bar handle', price: 14 },
  knob: { label: 'Knob', price: 9 },
  gola: { label: 'Gola / handleless', pricePerM: 48 },
} as const

function placeable(
  partial: Pick<CatalogItem, 'sku' | 'name' | 'category' | 'group' | 'style' | 'mount' | 'width' | 'height' | 'depth' | 'price'> &
    Partial<CatalogItem>,
): CatalogItem {
  const baseRange =
    partial.category === 'base'
      ? { minW: 150, maxW: 1200, minH: 800, maxH: 960, minD: 300, maxD: 650 }
      : partial.category === 'wall'
        ? { minW: 150, maxW: 1200, minH: 360, maxH: 960, minD: 200, maxD: 450 }
        : partial.category === 'tall'
          ? { minW: 300, maxW: 1200, minH: 2000, maxH: 2400, minD: 400, maxD: 650 }
          : { minW: partial.width, maxW: partial.width, minH: partial.height, maxH: partial.height, minD: partial.depth, maxD: partial.depth }
  return {
    kind: 'placeable',
    doorCount: 0,
    drawerCount: 0,
    elevation: partial.mount === 'wall' ? 1400 : 0,
    ...baseRange,
    ...partial,
  }
}

function finish(entry: Omit<SystemEntry, 'kind'>): SystemEntry {
  return { kind: 'system', ...entry }
}

export const LIBRARY: LibraryEntry[] = [
  placeable({ sku: 'B150', name: 'Base door 150', category: 'base', group: 'Standard', style: 'standard', mount: 'floor', width: 150, height: 870, depth: 560, price: 160, doorCount: 1 }),
  placeable({ sku: 'B300', name: 'Base door 300', category: 'base', group: 'Standard', style: 'standard', mount: 'floor', width: 300, height: 870, depth: 560, price: 210, doorCount: 1 }),
  placeable({ sku: 'B400', name: 'Base door 400', category: 'base', group: 'Standard', style: 'standard', mount: 'floor', width: 400, height: 870, depth: 560, price: 250, doorCount: 1 }),
  placeable({ sku: 'B500', name: 'Base door 500', category: 'base', group: 'Standard', style: 'standard', mount: 'floor', width: 500, height: 870, depth: 560, price: 290, doorCount: 1 }),
  placeable({ sku: 'B600', name: 'Base door 600', category: 'base', group: 'Standard', style: 'standard', mount: 'floor', width: 600, height: 870, depth: 560, price: 340, doorCount: 2 }),
  placeable({ sku: 'B800', name: 'Base door 800', category: 'base', group: 'Standard', style: 'standard', mount: 'floor', width: 800, height: 870, depth: 560, price: 420, doorCount: 2 }),
  placeable({ sku: 'B1000', name: 'Base door 1000', category: 'base', group: 'Standard', style: 'standard', mount: 'floor', width: 1000, height: 870, depth: 560, price: 510, doorCount: 2 }),
  placeable({ sku: 'DB300', name: 'Drawer stack 300', category: 'base', group: 'Drawer units', style: 'drawer', mount: 'floor', width: 300, height: 870, depth: 560, price: 280, drawerCount: 3 }),
  placeable({ sku: 'DB400', name: 'Drawer stack 400', category: 'base', group: 'Drawer units', style: 'drawer', mount: 'floor', width: 400, height: 870, depth: 560, price: 320, drawerCount: 3 }),
  placeable({ sku: 'DB500', name: 'Drawer stack 500', category: 'base', group: 'Drawer units', style: 'drawer', mount: 'floor', width: 500, height: 870, depth: 560, price: 360, drawerCount: 3 }),
  placeable({ sku: 'DB600', name: 'Drawer stack 600', category: 'base', group: 'Drawer units', style: 'drawer', mount: 'floor', width: 600, height: 870, depth: 560, price: 410, drawerCount: 3 }),
  placeable({ sku: 'SB600', name: 'Sink base 600', category: 'base', group: 'Sink units', style: 'sink', mount: 'floor', width: 600, height: 870, depth: 560, price: 390, doorCount: 1, drawerCount: 1 }),
  placeable({ sku: 'SB800', name: 'Sink base 800', category: 'base', group: 'Sink units', style: 'sink', mount: 'floor', width: 800, height: 870, depth: 560, price: 460, doorCount: 2, drawerCount: 1 }),
  placeable({ sku: 'SB1000', name: 'Sink base 1000', category: 'base', group: 'Sink units', style: 'sink', mount: 'floor', width: 1000, height: 870, depth: 560, price: 540, doorCount: 2, drawerCount: 1 }),
  placeable({ sku: 'L900', name: 'L-corner base 900', category: 'base', group: 'Corner & carousel', style: 'corner', mount: 'floor', width: 900, height: 870, depth: 900, price: 620, doorCount: 1, minW: 800, maxW: 1200, minD: 800, maxD: 1200 }),
  placeable({ sku: 'L1000', name: 'L-corner base 1000', category: 'base', group: 'Corner & carousel', style: 'corner', mount: 'floor', width: 1000, height: 870, depth: 1000, price: 690, doorCount: 1, minW: 800, maxW: 1200, minD: 800, maxD: 1200 }),
  placeable({ sku: 'CR800', name: 'Carousel corner 800', category: 'base', group: 'Corner & carousel', style: 'carousel', mount: 'floor', width: 800, height: 870, depth: 800, price: 760, doorCount: 1, minW: 700, maxW: 1000, minD: 700, maxD: 1000 }),

  placeable({ sku: 'W300', name: 'Wall door 300', category: 'wall', group: 'Single door', style: 'standard', mount: 'wall', width: 300, height: 720, depth: 330, price: 180, doorCount: 1 }),
  placeable({ sku: 'W400', name: 'Wall door 400', category: 'wall', group: 'Single door', style: 'standard', mount: 'wall', width: 400, height: 720, depth: 330, price: 210, doorCount: 1 }),
  placeable({ sku: 'W500', name: 'Wall door 500', category: 'wall', group: 'Single door', style: 'standard', mount: 'wall', width: 500, height: 720, depth: 330, price: 240, doorCount: 1 }),
  placeable({ sku: 'W600', name: 'Wall door 600', category: 'wall', group: 'Single door', style: 'standard', mount: 'wall', width: 600, height: 720, depth: 330, price: 270, doorCount: 1 }),
  placeable({ sku: 'W800', name: 'Wall double 800', category: 'wall', group: 'Double door', style: 'standard', mount: 'wall', width: 800, height: 720, depth: 330, price: 340, doorCount: 2 }),
  placeable({ sku: 'W1000', name: 'Wall double 1000', category: 'wall', group: 'Double door', style: 'standard', mount: 'wall', width: 1000, height: 720, depth: 330, price: 410, doorCount: 2 }),
  placeable({ sku: 'LF600', name: 'Lift-up flap 600', category: 'wall', group: 'Lift-up flap', style: 'flap', mount: 'wall', width: 600, height: 720, depth: 330, price: 300, doorCount: 1 }),
  placeable({ sku: 'LF900', name: 'Lift-up flap 900', category: 'wall', group: 'Lift-up flap', style: 'flap', mount: 'wall', width: 900, height: 720, depth: 330, price: 360, doorCount: 1 }),
  placeable({ sku: 'WG600', name: 'Glass display 600', category: 'wall', group: 'Glass display', style: 'glass', mount: 'wall', width: 600, height: 720, depth: 330, price: 320, doorCount: 1 }),
  placeable({ sku: 'WG800', name: 'Glass display 800', category: 'wall', group: 'Glass display', style: 'glass', mount: 'wall', width: 800, height: 720, depth: 330, price: 390, doorCount: 2 }),

  placeable({ sku: 'TP500', name: 'Pantry 500', category: 'tall', group: 'Pantry', style: 'pantry', mount: 'floor', width: 500, height: 2080, depth: 560, price: 720, doorCount: 1 }),
  placeable({ sku: 'TP600', name: 'Pantry 600', category: 'tall', group: 'Pantry', style: 'pantry', mount: 'floor', width: 600, height: 2080, depth: 560, price: 820, doorCount: 1 }),
  placeable({ sku: 'OV600', name: 'Oven tower 600', category: 'tall', group: 'Built-in oven tower', style: 'oven-tower', mount: 'floor', width: 600, height: 2080, depth: 560, price: 980, doorCount: 1, drawerCount: 1 }),
  placeable({ sku: 'FR600', name: 'Fridge housing 600', category: 'tall', group: 'Fridge housing', style: 'fridge', mount: 'floor', width: 600, height: 2080, depth: 560, price: 860, doorCount: 2 }),

  finish({
    sku: 'WT-GRANITE',
    name: 'Granite worktop',
    category: 'worktop',
    group: 'Worktop finishes',
    summary: 'Auto-cut along base runs',
    materials: { worktop: 'granite', worktopColor: WORKTOPS.granite.color },
    options: { autoWorktop: true },
    active: { worktop: 'granite' },
  }),
  finish({
    sku: 'WT-QUARTZ',
    name: 'Quartz worktop',
    category: 'worktop',
    group: 'Worktop finishes',
    summary: 'Auto-cut along base runs',
    materials: { worktop: 'quartz', worktopColor: WORKTOPS.quartz.color },
    options: { autoWorktop: true },
    active: { worktop: 'quartz' },
  }),
  finish({
    sku: 'WT-MARBLE',
    name: 'Marble worktop',
    category: 'worktop',
    group: 'Worktop finishes',
    summary: 'Auto-cut along base runs',
    materials: { worktop: 'marble', worktopColor: WORKTOPS.marble.color },
    options: { autoWorktop: true },
    active: { worktop: 'marble' },
  }),
  finish({
    sku: 'WT-WOOD',
    name: 'Solid wood worktop',
    category: 'worktop',
    group: 'Worktop finishes',
    summary: 'Auto-cut along base runs',
    materials: { worktop: 'wood', worktopColor: WORKTOPS.wood.color },
    options: { autoWorktop: true },
    active: { worktop: 'wood' },
  }),
  finish({
    sku: 'WT-STEEL',
    name: 'Stainless worktop',
    category: 'worktop',
    group: 'Worktop finishes',
    summary: 'Auto-cut along base runs',
    materials: { worktop: 'steel', worktopColor: WORKTOPS.steel.color },
    options: { autoWorktop: true },
    active: { worktop: 'steel' },
  }),
  finish({
    sku: 'SB-600',
    name: 'Splashback 600 mm',
    category: 'worktop',
    group: 'Splashbacks',
    summary: 'Runs with the worktop',
    options: { splashback: true, splashHeight: 600 },
    active: { splashback: true },
  }),
  finish({ sku: 'ED-SQ', name: 'Square edge', category: 'worktop', group: 'Edge profile', summary: 'Square arris', options: { edgeProfile: 'square' }, active: { edgeProfile: 'square' } }),
  finish({ sku: 'ED-PN', name: 'Pencil round', category: 'worktop', group: 'Edge profile', summary: 'Soft pencil round', options: { edgeProfile: 'pencil' }, active: { edgeProfile: 'pencil' } }),
  finish({ sku: 'ED-BN', name: 'Bullnose', category: 'worktop', group: 'Edge profile', summary: 'Full bullnose', options: { edgeProfile: 'bullnose' }, active: { edgeProfile: 'bullnose' } }),

  finish({ sku: 'PL-AUTO', name: 'Continuous plinth', category: 'trim', group: 'Plinths / skirting', summary: 'Auto-run along base units', options: { autoPlinth: true }, active: { autoPlinth: true } }),
  finish({ sku: 'CO-AUTO', name: 'Cornice & pelmet', category: 'trim', group: 'Cornices / pelmets', summary: 'Auto-run along wall units', options: { autoCornice: true }, active: { autoCornice: true } }),

  placeable({ sku: 'SNK-1B', name: 'Inset 1.0 bowl sink', category: 'appliance', group: 'Sinks & taps', style: 'sink-bowl', mount: 'inset', width: 460, height: 180, depth: 400, price: 180, minW: 360, maxW: 800, minD: 300, maxD: 500, elevation: 870 }),
  placeable({ sku: 'TAP-01', name: 'Single-lever tap', category: 'appliance', group: 'Sinks & taps', style: 'tap', mount: 'inset', width: 50, height: 340, depth: 50, price: 120, minW: 40, maxW: 80, minH: 180, maxH: 450, minD: 40, maxD: 80, elevation: 900 }),
  placeable({ sku: 'HOB-60', name: 'Induction hob 600', category: 'appliance', group: 'Cooking', style: 'hob', mount: 'inset', width: 560, height: 40, depth: 490, price: 420, minW: 500, maxW: 760, minD: 400, maxD: 540, elevation: 870 }),
  placeable({ sku: 'HOB-90', name: 'Induction hob 900', category: 'appliance', group: 'Cooking', style: 'hob', mount: 'inset', width: 860, height: 40, depth: 490, price: 560, minW: 700, maxW: 980, minD: 400, maxD: 540, elevation: 870 }),
  placeable({ sku: 'HD-60', name: 'Chimney hood 600', category: 'appliance', group: 'Hoods', style: 'hood', mount: 'wall', width: 600, height: 640, depth: 320, price: 340, minW: 500, maxW: 900, minH: 400, maxH: 900, elevation: 1560 }),
  placeable({ sku: 'HD-90', name: 'Chimney hood 900', category: 'appliance', group: 'Hoods', style: 'hood', mount: 'wall', width: 900, height: 640, depth: 320, price: 420, minW: 700, maxW: 1200, minH: 400, maxH: 900, elevation: 1560 }),
  placeable({ sku: 'OV-60', name: 'Built-in oven', category: 'appliance', group: 'Cooking', style: 'oven', mount: 'housing', width: 595, height: 595, depth: 550, price: 560, minW: 560, maxW: 600, elevation: 360 }),
  placeable({ sku: 'DW-60', name: 'Dishwasher 600', category: 'appliance', group: 'Laundry', style: 'dishwasher', mount: 'floor', width: 600, height: 870, depth: 560, price: 480, doorCount: 1, minW: 450, maxW: 600 }),
  placeable({ sku: 'FF-60', name: 'Integrated fridge', category: 'appliance', group: 'Cooling', style: 'fridge-app', mount: 'housing', width: 560, height: 1780, depth: 545, price: 740, minW: 540, maxW: 600, elevation: 150 }),

  placeable({ sku: 'VAN-600', name: 'Basin vanity 600', category: 'sanitary', group: 'Basins', style: 'sink', mount: 'floor', width: 600, height: 850, depth: 460, price: 420, doorCount: 2, minW: 400, maxW: 1200, minD: 300, maxD: 550 }),
  placeable({ sku: 'BAS-01', name: 'Countertop basin', category: 'sanitary', group: 'Basins', style: 'basin', mount: 'inset', width: 480, height: 140, depth: 380, price: 160, minW: 360, maxW: 700, elevation: 850 }),
  placeable({ sku: 'WC-01', name: 'Close-coupled WC', category: 'sanitary', group: 'WC', style: 'wc', mount: 'floor', width: 400, height: 820, depth: 650, price: 280, minW: 360, maxW: 450, minD: 550, maxD: 750 }),
  placeable({ sku: 'BATH-170', name: 'Bath 1700', category: 'sanitary', group: 'Baths', style: 'bath', mount: 'floor', width: 1700, height: 580, depth: 750, price: 690, minW: 1500, maxW: 1800, minD: 700, maxD: 850 }),
]

export const catalogBySku: Record<string, CatalogItem> = Object.fromEntries(
  LIBRARY.filter((entry): entry is CatalogItem => entry.kind === 'placeable').map((entry) => [entry.sku, entry]),
)

export function resetCatalogGeometry(overlay: CatalogItem[] | null) {
  for (const key of Object.keys(catalogBySku)) delete catalogBySku[key]
  for (const entry of LIBRARY) {
    if (entry.kind === 'placeable') catalogBySku[entry.sku] = entry
  }
  if (!overlay) return
  for (const item of overlay) catalogBySku[item.sku] = item
}

export function isCabinet(style: UnitStyle) {
  return !['hob', 'hood', 'oven', 'dishwasher', 'sink-bowl', 'tap', 'basin', 'wc', 'bath', 'fridge-app'].includes(style)
}

export function inWorktopRun(item: CatalogItem) {
  return item.category === 'base' || item.style === 'dishwasher'
}

export function inCorniceRun(item: CatalogItem) {
  return item.category === 'wall' || item.style === 'hood'
}

export function isFloorNeighbour(item: CatalogItem) {
  return item.mount === 'floor' && !['wc', 'bath', 'basin', 'hob', 'sink-bowl', 'tap', 'oven', 'hood', 'fridge-app'].includes(item.style)
}
