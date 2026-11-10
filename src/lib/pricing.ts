import { DOOR_STYLES, HANDLES, WORKTOPS, catalogBySku, isCabinet } from '../catalog'
import { buildRuns, exposedSideCount } from './runs'
import type { CurrencyCode, DesignOptions, Materials, Opening, PlacedItem, Wall } from '../types'

export interface QuoteLine {
  sku: string
  name: string
  detail: string
  qty: number
  unit: string
  unitPrice: number
  total: number
}

export interface Quote {
  lines: QuoteLine[]
  counts: {
    cabinets: number
    doors: number
    drawers: number
    handles: number
    endPanels: number
    plinthM: number
    corniceM: number
    pelmetM: number
    worktopM2: number
    splashM2: number
  }
  net: number
  fitting: number
  vat: number
  gross: number
  notes: string
}

const MONEY_LOCALE: Record<CurrencyCode, string> = { GBP: 'en-GB', EUR: 'de-DE', USD: 'en-US' }

export function money(value: number, currency: CurrencyCode = 'GBP') {
  return new Intl.NumberFormat(MONEY_LOCALE[currency], { style: 'currency', currency }).format(value)
}

export function moneyPlain(value: number, currency: CurrencyCode = 'GBP') {
  return money(value, currency).replace(/\u00a0/g, ' ')
}

function line(sku: string, name: string, detail: string, qty: number, unit: string, unitPrice: number): QuoteLine {
  return { sku, name, detail, qty, unit, unitPrice, total: qty * unitPrice }
}

export function buildQuote(input: {
  items: PlacedItem[]
  walls: Wall[]
  openings: Opening[]
  materials: Materials
  options: DesignOptions
  groupMult?: number
  priceOf?: (sku: string, fallback: number) => number
}): Quote {
  const { items, walls, openings, materials, options } = input
  const groupMult = input.groupMult ?? 1
  const priceOf = input.priceOf ?? ((_sku: string, fallback: number) => fallback)
  const multiplier = DOOR_STYLES[materials.doorStyle].multiplier
  const lines: QuoteLine[] = []
  let cabinets = 0
  let doors = 0
  let drawers = 0
  let handles = 0
  let endPanels = 0
  let golaM = 0
  let fitting = 0

  for (const item of items) {
    const spec = catalogBySku[item.sku]
    if (!spec) continue
    const scale = item.width / spec.width
    let unitPrice = priceOf(spec.sku, spec.price) * scale * groupMult
    const cabinet = isCabinet(spec.style) && (spec.category === 'base' || spec.category === 'wall' || spec.category === 'tall' || spec.category === 'sanitary')
    if (cabinet && spec.category !== 'sanitary') unitPrice *= multiplier
    if (cabinet && spec.category === 'sanitary') unitPrice *= multiplier
    if (Math.abs(item.width - spec.width) > 2 && cabinet) unitPrice += 35
    lines.push(
      line(
        spec.sku,
        spec.name,
        `${Math.round(item.width)} × ${Math.round(item.height)} × ${Math.round(item.depth)} mm`,
        1,
        'ea',
        unitPrice,
      ),
    )
    if (cabinet) {
      cabinets += 1
      doors += spec.doorCount
      drawers += spec.drawerCount
      endPanels += exposedSideCount(item, items, walls)
      if (materials.handle === 'gola' || materials.handlePlacement === 'handleless') golaM += item.width / 1000
      else handles += spec.doorCount + spec.drawerCount
      fitting += options.fittingRate
    } else if (spec.style === 'dishwasher') {
      if (materials.handle !== 'gola') handles += spec.doorCount
      fitting += 40
    } else if (['hob', 'hood', 'oven', 'sink-bowl', 'tap', 'fridge-app', 'basin'].includes(spec.style)) {
      fitting += 40
    }
  }

  const baseRuns = buildRuns(items, walls, 'base')
  const wallRuns = buildRuns(items, walls, 'wall')
  let plinthM = 0
  let worktopM2 = 0
  for (const run of baseRuns) {
    const lengthM = (run.t1 - run.t0) / 1000
    plinthM += lengthM
    worktopM2 += lengthM * ((run.depth + 20) / 1000)
  }
  const corniceM = wallRuns.reduce((sum, run) => sum + (run.t1 - run.t0) / 1000, 0)
  const splashM2 = options.splashback ? baseRuns.reduce((sum, run) => sum + ((run.t1 - run.t0) / 1000) * (options.splashHeight / 1000), 0) : 0

  const priced = (sku: string, name: string, detail: string, qty: number, unit: string, unitPrice: number) =>
    line(sku, name, detail, qty, unit, unitPrice * groupMult)
  if (endPanels > 0) lines.push(priced('EP-18', 'End panel', '18 mm finished panel', endPanels, 'ea', 45 * multiplier))
  if (materials.handle === 'gola' || materials.handlePlacement === 'handleless') {
    if (golaM > 0) lines.push(priced('HD-GOLA', 'Gola profile', 'Handleless rail', golaM, 'm', HANDLES.gola.pricePerM))
  } else if (handles > 0) {
    const handle = materials.handle === 'knob' || materials.handlePlacement === 'knob' ? HANDLES.knob : HANDLES.bar
    lines.push(priced(materials.handle === 'bar' ? 'HD-BAR' : 'HD-KNOB', handle.label, 'Fitted to doors and drawers', handles, 'ea', handle.price))
  }
  const pelmetM = options.autoPelmet ? corniceM : 0
  if (options.autoPlinth && plinthM > 0) lines.push(priced('PL-RUN', 'Plinth run', 'Continuous mitred skirting', plinthM, 'm', 22))
  if (options.autoCornice && corniceM > 0) lines.push(priced('CO-RUN', 'Cornice', 'Continuous top moulding', corniceM, 'm', 28))
  if (options.autoPelmet && pelmetM > 0) lines.push(priced('PE-RUN', 'Light pelmet', 'Under-cabinet pelmet', pelmetM, 'm', 18))
  const cutouts = items.filter((item) => ['hob', 'sink-bowl', 'basin'].includes(catalogBySku[item.sku]?.style ?? '')).length
  if (options.autoWorktop && worktopM2 > 0) {
    const finish = WORKTOPS[materials.worktop]
    lines.push(priced(`WT-${materials.worktop.toUpperCase()}`, `${finish.label} worktop`, `${options.edgeProfile} edge · ${cutouts} cutouts · mitred`, worktopM2, 'm2', finish.price))
  }
  if (options.splashback && splashM2 > 0) {
    lines.push(priced('SP-RUN', 'Splashback', `${options.splashHeight} mm high`, splashM2, 'm2', WORKTOPS[materials.worktop].price * 0.55))
  }

  const goods = lines.reduce((sum, entry) => sum + entry.total, 0)
  const discountValue = goods * (options.discount / 100)
  const afterDiscount = goods - discountValue
  const marginValue = afterDiscount * (options.margin / 100)
  if (discountValue > 0.004) lines.push(line('DISC', `Discount ${options.discount}%`, `Price group ${options.priceGroup}`, 1, 'ea', -discountValue))
  if (marginValue > 0.004) lines.push(line('MARGIN', `Margin ${options.margin}%`, 'Supplier margin', 1, 'ea', marginValue))
  if (!options.fittingEnabled) fitting = 0
  const net = afterDiscount + marginValue + fitting
  const vat = net * (options.vat / 100)
  const gross = net + vat
  const doorCount = openings.filter((opening) => opening.type === 'door').length
  const windowCount = openings.filter((opening) => opening.type === 'window').length
  const nicheCount = openings.filter((opening) => opening.type === 'niche').length
  const notes = `${doorCount} door, ${windowCount} window, ${nicheCount} niche shown as builder's work and not priced. Quotation valid 30 days. Delivery excluded.`

  return {
    lines,
    counts: { cabinets, doors, drawers, handles, endPanels, plinthM, corniceM, pelmetM, worktopM2, splashM2 },
    net: afterDiscount + marginValue,
    fitting,
    vat,
    gross,
    notes,
  }
}
