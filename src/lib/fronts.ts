import type { CatalogItem, DoorHinge, PlacedItem } from '../types'

export interface LaidFront {
  index: number | null
  x: number
  y: number
  w: number
  h: number
  kind: 'door' | 'drawer' | 'glass' | 'oven' | 'flap'
  hinge: DoorHinge | 'center'
}

function chosenHinge(item: PlacedItem, index: number, fallback: DoorHinge): DoorHinge {
  return item.fronts?.find((front) => front.index === index)?.hinge ?? fallback
}

function doorHinge(item: PlacedItem, index: number, doors: number): DoorHinge {
  const fallback: DoorHinge = doors === 1 ? (item.handing === 'left' ? 'left' : 'right') : index === 0 ? 'left' : 'right'
  return chosenHinge(item, index, fallback)
}

export function layoutFronts(item: PlacedItem, spec: CatalogItem, plinth: number): LaidFront[] {
  const w = item.width / 1000
  const h = item.height / 1000
  const gap = 0.003
  const usable = Math.max(0.05, h - plinth)
  if (spec.style === 'oven-tower') {
    const drawerH = 0.18
    const ovenH = 0.6
    const rest = Math.max(0.08, usable - drawerH - ovenH)
    return [
      { index: null, x: 0, y: plinth + drawerH / 2, w: w - gap * 2, h: drawerH - gap, kind: 'drawer', hinge: 'center' },
      { index: null, x: 0, y: plinth + drawerH + ovenH / 2, w: w - 0.05, h: ovenH - 0.03, kind: 'oven', hinge: 'center' },
      {
        index: 0,
        x: 0,
        y: plinth + drawerH + ovenH + rest / 2,
        w: w - gap * 2,
        h: rest - gap,
        kind: 'door',
        hinge: chosenHinge(item, 0, item.handing === 'left' ? 'left' : 'right'),
      },
    ]
  }
  if (spec.drawerCount > 0 && spec.doorCount === 0) {
    const dh = usable / spec.drawerCount
    return Array.from({ length: spec.drawerCount }, (_, index) => ({
      index: null,
      x: 0,
      y: plinth + dh * index + dh / 2,
      w: w - gap * 2,
      h: dh - gap,
      kind: 'drawer' as const,
      hinge: 'center' as const,
    }))
  }
  if (spec.style === 'sink' && spec.drawerCount > 0) {
    const drawerH = 0.16
    const doorH = usable - drawerH
    const doors = Math.max(1, spec.doorCount)
    const dw = w / doors
    return [
      ...Array.from({ length: doors }, (_, index) => ({
        index,
        x: -w / 2 + dw * index + dw / 2,
        y: plinth + doorH / 2,
        w: dw - gap,
        h: doorH - gap,
        kind: 'door' as const,
        hinge: doorHinge(item, index, doors),
      })),
      { index: null, x: 0, y: plinth + doorH + drawerH / 2, w: w - gap * 2, h: drawerH - gap, kind: 'drawer' as const, hinge: 'center' as const },
    ]
  }
  const doors = Math.max(1, spec.doorCount || 1)
  const dw = w / doors
  const kind: LaidFront['kind'] = spec.style === 'glass' ? 'glass' : spec.style === 'flap' ? 'flap' : 'door'
  return Array.from({ length: doors }, (_, index) => ({
    index,
    x: -w / 2 + dw * index + dw / 2,
    y: plinth + usable / 2,
    w: dw - gap,
    h: usable - gap,
    kind,
    hinge: kind === 'flap' ? chosenHinge(item, index, 'top') : doorHinge(item, index, doors),
  }))
}

export function cabinetDoors(item: PlacedItem, spec: CatalogItem) {
  if (spec.style === 'corner' || spec.style === 'carousel') return []
  return layoutFronts(item, spec, 0).flatMap((front) =>
    front.index == null || front.hinge === 'center' ? [] : [{ index: front.index, hinge: front.hinge }],
  )
}
