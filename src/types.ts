export interface Pt {
  x: number
  y: number
}

export type Tool =
  | 'select'
  | 'wall'
  | 'pan'
  | 'door'
  | 'window'
  | 'niche'
  | 'pillar'
  | 'beam'
  | 'chimney'
  | 'pipe'
  | 'place'
  | 'measure'

/** Where an automatic measurement line sits. */
export type DimensionAlign = 'auto' | 'close' | 'manual'

/** A free-drawn measurement. `offset` is the signed distance of the line from a–b. */
export interface Measure {
  id: string
  a: Pt
  b: Pt
  offset: number
}

export type ViewMode = 'plan' | '3d' | 'elevation' | 'split' | 'walk'

export type CategoryId =
  | 'base'
  | 'wall'
  | 'tall'
  | 'worktop'
  | 'trim'
  | 'appliance'
  | 'sanitary'

export type Mount = 'floor' | 'wall' | 'inset' | 'housing'

export type UnitStyle =
  | 'standard'
  | 'drawer'
  | 'sink'
  | 'corner'
  | 'carousel'
  | 'flap'
  | 'glass'
  | 'pantry'
  | 'oven-tower'
  | 'fridge'
  | 'hob'
  | 'hood'
  | 'oven'
  | 'dishwasher'
  | 'sink-bowl'
  | 'tap'
  | 'basin'
  | 'wc'
  | 'bath'
  | 'fridge-app'

export type DoorStyle = 'high-gloss' | 'matte' | 'wood' | 'shaker' | 'raised'
export type HandlePlacement = 'auto' | 'vertical' | 'horizontal-top' | 'knob' | 'handleless'
export type RoofStyle = 'flat' | 'shed' | 'gable'
export type CurrencyCode = 'GBP' | 'EUR' | 'USD'
export type WorktopFinish = 'granite' | 'quartz' | 'marble' | 'wood' | 'steel'
export type HandleStyle = 'bar' | 'knob' | 'gola'
export type EdgeProfile = 'square' | 'pencil' | 'bullnose'
export type LightingPreset = 'studio' | 'daylight' | 'evening'
export type Handing = 'left' | 'right'
export type DoorHinge = 'left' | 'right' | 'top' | 'bottom'

export interface DoorFront {
  index: number
  hinge: DoorHinge
}
export type ProjectStatus = 'enquiry' | 'survey' | 'validate' | 'design' | 'review' | 'quote' | 'approval' | 'order' | 'fulfilment' | 'install'
export type DocumentPrivacy = 'private' | 'shop'

export interface StatusEvent {
  at: string
  by: string
  status: ProjectStatus
}

export interface ProjectComment {
  id: string
  at: string
  by: string
  text: string
}

export interface ProjectDocument {
  id: string
  name: string
  privacy: DocumentPrivacy
  note: string
  data?: string
}

export interface LeadInfo {
  source: string
  budget: string
}

export interface CatalogItem {
  kind: 'placeable'
  sku: string
  name: string
  category: CategoryId
  group: string
  style: UnitStyle
  mount: Mount
  width: number
  height: number
  depth: number
  minW: number
  maxW: number
  minH: number
  maxH: number
  minD: number
  maxD: number
  price: number
  doorCount: number
  drawerCount: number
  elevation: number
}

export interface SystemEntry {
  kind: 'system'
  sku: string
  name: string
  category: CategoryId
  group: string
  summary: string
  materials?: Partial<Materials>
  options?: Partial<DesignOptions>
  active?: {
    worktop?: WorktopFinish
    edgeProfile?: EdgeProfile
    autoWorktop?: boolean
    autoPlinth?: boolean
    autoCornice?: boolean
    splashback?: boolean
  }
}

export type LibraryEntry = CatalogItem | SystemEntry

export interface Wall {
  id: string
  a: Pt
  b: Pt
  thickness: number
  /** Ceiling height at endpoint A, millimetres. Omitted walls follow the roof. */
  heightA?: number
  /** Ceiling height at endpoint B, millimetres. */
  heightB?: number
  /** Overrides the system dimension alignment. Omitted walls inherit it. */
  dimensionAlign?: DimensionAlign
  /** Overall line distance from the wall centre, along the outward normal. */
  dimensionOffset?: number
  /** Cabinet-chain distance from the wall centre, along the inward normal. */
  runOffset?: number
}

export interface Opening {
  id: string
  wallId: string
  type: 'door' | 'window' | 'niche'
  offset: number
  width: number
  height: number
  sill: number
  flip: boolean
}

export interface Fixture {
  id: string
  type: 'pillar' | 'beam' | 'chimney' | 'pipe' | 'dormer'
  x: number
  y: number
  width: number
  depth: number
  rotation: number
  wallId?: string
  /** Height of a dormer or the visible rise of a pipe, millimetres. */
  height?: number
}

export interface PlacedItem {
  id: string
  sku: string
  x: number
  y: number
  rotation: number
  width: number
  height: number
  depth: number
  wallId?: string
  handing: Handing
  elevation: number
  hostId?: string
  /** Door, flap, or drawer opening in degrees. 0 is closed. */
  open?: number
  /** Per-door hinge overrides. Missing doors keep the handing default. */
  fronts?: DoorFront[]
}

export interface Materials {
  doorStyle: DoorStyle
  doorColor: string
  /** RAL or NCS code for the door colour. Empty when the colour is a plain hex value. */
  doorColorCode: string
  worktop: WorktopFinish
  worktopColor: string
  /** RAL or NCS code for the worktop colour. Empty when the colour is a plain hex value. */
  worktopColorCode: string
  wallPaint: string
  floorTile: string
  grout: string
  tileSize: number
  splashTile: string
  splashGrout: string
  splashTileSize: number
  /** Tile direction on the splashback, degrees. */
  splashTileAngle: number
  handle: HandleStyle
  handleColor: string
  handlePlacement: HandlePlacement
  /** Wood-grain and stone-vein direction on fronts and worktops, degrees. */
  grainAngle: number
}

export interface DesignOptions {
  autoWorktop: boolean
  autoPlinth: boolean
  autoCornice: boolean
  splashback: boolean
  splashHeight: number
  worktopThickness: number
  plinthHeight: number
  ceiling: number
  vat: number
  fittingEnabled: boolean
  fittingRate: number
  lighting: LightingPreset
  underLights: boolean
  autoPelmet: boolean
  edgeProfile: EdgeProfile
  roofStyle: RoofStyle
  kneeHeight: number
  ridgeHeight: number
  roofLowWallId: string | null
  sunAzimuth: number
  sunElevation: number
  sunIntensity: number
  ledKelvin: number
  ledIntensity: number
  ambientOcclusion: boolean
  screenReflections: boolean
  priceGroup: number
  discount: number
  margin: number
  currency: CurrencyCode
  /** Default placement for automatic measurement lines. */
  dimensionAlign: DimensionAlign
}

export interface ClientInfo {
  name: string
  address: string
  reference: string
}

export type Selection =
  | { type: 'wall'; id: string }
  | { type: 'opening'; id: string }
  | { type: 'fixture'; id: string }
  | { type: 'item'; id: string }
  | { type: 'measure'; id: string }
  | { type: 'dimension'; id: string; wallId: string; kind: 'overall' | 'run' }

export interface DesignSnapshot {
  projectName: string
  defaultThickness: number
  walls: Wall[]
  measures: Measure[]
  openings: Opening[]
  fixtures: Fixture[]
  items: PlacedItem[]
  materials: Materials
  options: DesignOptions
  client: ClientInfo
  status: ProjectStatus
  statusHistory: StatusEvent[]
  revision: number
  locked: boolean
  lead: LeadInfo
  comments: ProjectComment[]
  documents: ProjectDocument[]
  surveyNotes: string
}
