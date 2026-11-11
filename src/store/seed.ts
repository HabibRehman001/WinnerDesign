import type { DesignSnapshot, Opening, PlacedItem, Wall } from '../types'

const thickness = 150

export const seedWalls: Wall[] = [
  { id: 'wall-n', a: { x: 0, y: 0 }, b: { x: 4200, y: 0 }, thickness },
  { id: 'wall-e', a: { x: 4200, y: 0 }, b: { x: 4200, y: 3300 }, thickness },
  { id: 'wall-s', a: { x: 4200, y: 3300 }, b: { x: 0, y: 3300 }, thickness },
  { id: 'wall-w', a: { x: 0, y: 3300 }, b: { x: 0, y: 0 }, thickness },
]

const baseY = 355
const wallY = 240

function item(partial: PlacedItem): PlacedItem {
  return partial
}

export const seedItems: PlacedItem[] = [
  item({ id: 'it-pantry', sku: 'TP600', x: 375, y: baseY, rotation: 0, width: 600, height: 2080, depth: 560, wallId: 'wall-n', handing: 'left', elevation: 0 }),
  item({ id: 'it-oven', sku: 'OV600', x: 975, y: baseY, rotation: 0, width: 600, height: 2080, depth: 560, wallId: 'wall-n', handing: 'left', elevation: 0 }),
  item({ id: 'it-base', sku: 'B600', x: 1575, y: baseY, rotation: 0, width: 600, height: 870, depth: 560, wallId: 'wall-n', handing: 'left', elevation: 0 }),
  item({ id: 'it-sink', sku: 'SB800', x: 2275, y: baseY, rotation: 0, width: 800, height: 870, depth: 560, wallId: 'wall-n', handing: 'left', elevation: 0 }),
  item({ id: 'it-draw', sku: 'DB500', x: 2925, y: baseY, rotation: 0, width: 500, height: 870, depth: 560, wallId: 'wall-n', handing: 'left', elevation: 0 }),
  item({ id: 'it-dw', sku: 'DW-60', x: 3475, y: baseY, rotation: 0, width: 600, height: 870, depth: 560, wallId: 'wall-n', handing: 'left', elevation: 0 }),
  item({ id: 'it-b300', sku: 'B300', x: 3925, y: baseY, rotation: 0, width: 300, height: 870, depth: 560, wallId: 'wall-n', handing: 'right', elevation: 0 }),
  item({ id: 'it-w8', sku: 'W800', x: 2275, y: wallY, rotation: 0, width: 800, height: 720, depth: 330, wallId: 'wall-n', handing: 'left', elevation: 1400 }),
  item({ id: 'it-w5', sku: 'W500', x: 2925, y: wallY, rotation: 0, width: 500, height: 720, depth: 330, wallId: 'wall-n', handing: 'left', elevation: 1400 }),
  item({ id: 'it-w6', sku: 'W600', x: 3475, y: wallY, rotation: 0, width: 600, height: 720, depth: 330, wallId: 'wall-n', handing: 'left', elevation: 1400 }),
  item({ id: 'it-w3', sku: 'W300', x: 3925, y: wallY, rotation: 0, width: 300, height: 720, depth: 330, wallId: 'wall-n', handing: 'right', elevation: 1400 }),
  item({ id: 'it-hood', sku: 'HD-60', x: 1575, y: 235, rotation: 0, width: 600, height: 640, depth: 320, wallId: 'wall-n', handing: 'left', elevation: 1560 }),
  item({ id: 'it-hob', sku: 'HOB-60', x: 1575, y: baseY, rotation: 0, width: 560, height: 40, depth: 490, wallId: 'wall-n', handing: 'left', elevation: 870, hostId: 'it-base' }),
  item({ id: 'it-bowl', sku: 'SNK-1B', x: 2275, y: baseY, rotation: 0, width: 460, height: 180, depth: 400, wallId: 'wall-n', handing: 'left', elevation: 870, hostId: 'it-sink' }),
  item({ id: 'it-tap', sku: 'TAP-01', x: 2275, y: baseY, rotation: 0, width: 50, height: 340, depth: 50, wallId: 'wall-n', handing: 'left', elevation: 900, hostId: 'it-sink' }),
]

export const seedOpenings: Opening[] = [
  { id: 'op-door', wallId: 'wall-e', type: 'door', offset: 1650, width: 860, height: 2040, sill: 0, flip: false },
  { id: 'op-win', wallId: 'wall-w', type: 'window', offset: 1650, width: 1400, height: 1200, sill: 900, flip: false },
]

export function createSeed(): DesignSnapshot {
  return {
    projectName: 'Untitled kitchen',
    defaultThickness: 150,
    walls: seedWalls,
    measures: [],
    openings: seedOpenings,
    fixtures: [],
    items: seedItems,
    materials: {
      doorStyle: 'shaker',
      doorColor: '#F6F3EC',
      doorColorCode: '',
      worktop: 'quartz',
      worktopColor: '#E4DFD8',
      worktopColorCode: '',
      wallPaint: '#F7F5F2',
      floorTile: '#D9D3C9',
      grout: '#B7B1A8',
      tileSize: 600,
      splashTile: '#F4F1EC',
      splashGrout: '#C8C2B8',
      splashTileSize: 100,
      splashTileAngle: 0,
      handle: 'bar',
      handleColor: '#C5CCD1',
      handlePlacement: 'auto',
      grainAngle: 90,
    },
    options: {
      autoWorktop: true,
      autoPlinth: true,
      autoCornice: true,
      splashback: true,
      splashHeight: 600,
      worktopThickness: 30,
      plinthHeight: 150,
      ceiling: 2400,
      vat: 20,
      fittingEnabled: true,
      fittingRate: 75,
      lighting: 'daylight',
      underLights: true,
      autoPelmet: true,
      edgeProfile: 'pencil',
      roofStyle: 'flat',
      kneeHeight: 1400,
      ridgeHeight: 2800,
      roofLowWallId: 'wall-w',
      sunAzimuth: 270,
      sunElevation: 48,
      sunIntensity: 2.2,
      ledKelvin: 3500,
      ledIntensity: 1.1,
      ambientOcclusion: false,
      screenReflections: false,
      priceGroup: 1,
      discount: 0,
      margin: 0,
      currency: 'GBP',
      dimensionAlign: 'auto',
    },
    client: { name: '', address: '', reference: 'Q-1048' },
    status: 'design',
    statusHistory: [{ at: new Date().toISOString(), by: 'Local', status: 'design' }],
    revision: 1,
    locked: false,
    lead: { source: 'Showroom', budget: '' },
    comments: [],
    documents: [],
    surveyNotes: '',
  }
}
