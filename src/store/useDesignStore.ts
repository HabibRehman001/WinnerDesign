import { create } from 'zustand'
import { catalogBySku } from '../catalog'
import { clampOpening, reseatFixture, reseatItem } from '../lib/geometry'
import type {
  ClientInfo,
  DesignOptions,
  DesignSnapshot,
  Fixture,
  Handing,
  LeadInfo,
  Materials,
  Opening,
  PlacedItem,
  ProjectDocument,
  ProjectStatus,
  Selection,
  SystemEntry,
  Tool,
  ViewMode,
  Wall,
} from '../types'
import { createSeed } from './seed'
import { canApprove, canEditDesign, useOfficeStore } from './useOfficeStore'

const STORAGE_KEY = 'winner-design-document-v1'

export interface DesignState extends DesignSnapshot {
  selection: Selection | null
  tool: Tool
  activeSku: string | null
  view: ViewMode
  showDimensions: boolean
  inspectorTab: 'object' | 'finish' | 'quote'
  past: DesignSnapshot[]
  future: DesignSnapshot[]
  gesturing: boolean
  setTool: (tool: Tool) => void
  setView: (view: ViewMode) => void
  setShowDimensions: (show: boolean) => void
  setInspectorTab: (tab: DesignState['inspectorTab']) => void
  setActiveSku: (sku: string | null) => void
  setProjectName: (name: string) => void
  setClient: (client: Partial<ClientInfo>) => void
  beginGesture: () => void
  endGesture: () => void
  patchMaterials: (partial: Partial<Materials>) => void
  patchOptions: (partial: Partial<DesignOptions>) => void
  applySystem: (entry: SystemEntry) => void
  addWall: (wall: Wall) => void
  setWalls: (walls: Wall[], history?: boolean) => void
  updateWall: (id: string, partial: Partial<Wall>, history?: boolean) => void
  addOpening: (opening: Opening) => void
  updateOpening: (id: string, partial: Partial<Opening>, history?: boolean) => void
  addFixture: (fixture: Fixture) => void
  updateFixture: (id: string, partial: Partial<Fixture>, history?: boolean) => void
  addItem: (item: PlacedItem) => void
  updateItem: (id: string, partial: Partial<PlacedItem>, history?: boolean) => void
  replaceItems: (items: PlacedItem[], history?: boolean) => void
  setSelection: (selection: Selection | null) => void
  deleteSelection: () => void
  setHanding: (id: string, handing: Handing) => void
  setFrontsOpen: (degrees: number) => void
  undo: () => void
  redo: () => void
  resetDesign: () => void
  loadDocument: (data: unknown) => void
  setStatus: (status: ProjectStatus) => void
  lockRevision: () => void
  openRevision: () => void
  setLead: (lead: Partial<LeadInfo>) => void
  setSurveyNotes: (notes: string) => void
  addComment: (text: string) => void
  addDocument: (document: ProjectDocument) => void
  duplicateProject: () => void
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function snapshotOf(state: DesignSnapshot): DesignSnapshot {
  return {
    projectName: state.projectName,
    defaultThickness: state.defaultThickness,
    walls: clone(state.walls),
    openings: clone(state.openings),
    fixtures: clone(state.fixtures),
    items: clone(state.items),
    materials: clone(state.materials),
    options: clone(state.options),
    client: clone(state.client),
    status: state.status,
    statusHistory: clone(state.statusHistory),
    revision: state.revision,
    locked: state.locked,
    lead: clone(state.lead),
    comments: clone(state.comments),
    documents: clone(state.documents),
    surveyNotes: state.surveyNotes,
  }
}

function seat(walls: Wall[], items: PlacedItem[], openings: Opening[], fixtures: Fixture[]) {
  return {
    walls,
    items: items.map((item) => {
      const wall = walls.find((entry) => entry.id === item.wallId)
      return wall ? reseatItem(item, wall, walls) : item
    }),
    openings: openings.flatMap((opening) => {
      const wall = walls.find((entry) => entry.id === opening.wallId)
      return wall ? [clampOpening(opening, wall)] : []
    }),
    fixtures: fixtures.map((fixture) => {
      const wall = walls.find((entry) => entry.id === fixture.wallId)
      return wall ? reseatFixture(fixture, wall, walls) : fixture
    }),
  }
}

function editsBlocked(state: DesignState) {
  if (!canEditDesign()) return true
  return state.locked && !canApprove()
}

function withHistory(state: DesignState, partial: Partial<DesignState>, history: boolean): Partial<DesignState> {
  if (editsBlocked(state)) return {}
  if (!history || state.gesturing) return partial
  return { ...partial, past: [...state.past, snapshotOf(state)].slice(-40), future: [] }
}

function readStorage(): { snap: DesignSnapshot; view: ViewMode; showDimensions: boolean } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<DesignSnapshot> & { view?: ViewMode; showDimensions?: boolean; v?: number }
    if (!Array.isArray(data.walls) || !Array.isArray(data.items)) return null
    const seed = createSeed()
    return {
      snap: {
        ...seed,
        ...data,
        materials: { ...seed.materials, ...data.materials },
        options: { ...seed.options, ...data.options },
        client: { ...seed.client, ...data.client },
        status: data.status ?? seed.status,
        statusHistory: data.statusHistory ?? seed.statusHistory,
        revision: data.revision ?? seed.revision,
        locked: data.locked ?? false,
        lead: { ...seed.lead, ...data.lead },
        comments: data.comments ?? [],
        documents: data.documents ?? [],
        surveyNotes: data.surveyNotes ?? '',
        walls: data.walls as Wall[],
        openings: (data.openings as Opening[]) ?? [],
        fixtures: (data.fixtures as Fixture[]) ?? [],
        items: (data.items as PlacedItem[]).map((item) => ({ open: 0, ...item })),
      },
      view: data.view ?? 'plan',
      showDimensions: data.showDimensions ?? true,
    }
  } catch {
    return null
  }
}

const stored = readStorage()
const initial = stored?.snap ?? createSeed()

export const useDesignStore = create<DesignState>((set, get) => ({
  ...initial,
  selection: null,
  tool: 'select',
  activeSku: null,
  view: stored?.view ?? 'split',
  showDimensions: stored?.showDimensions ?? true,
  inspectorTab: 'object',
  past: [],
  future: [],
  gesturing: false,
  setTool: (tool) => set({ tool, ...(tool === 'place' ? {} : {}) }),
  setView: (view) => set({ view }),
  setShowDimensions: (showDimensions) => set({ showDimensions }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setActiveSku: (activeSku) => set({ activeSku, tool: activeSku ? 'place' : get().tool }),
  setProjectName: (projectName) => set({ projectName }),
  setClient: (client) => set((state) => ({ client: { ...state.client, ...client } })),
  beginGesture: () =>
    set((state) => (editsBlocked(state) || state.gesturing ? state : { gesturing: true, past: [...state.past, snapshotOf(state)].slice(-40), future: [] })),
  endGesture: () => set({ gesturing: false }),
  patchMaterials: (partial) => set((state) => (editsBlocked(state) ? state : { materials: { ...state.materials, ...partial } })),
  patchOptions: (partial) =>
    set((state) => {
      if (editsBlocked(state)) return state
      if (partial.discount != null && partial.discount > 10 && !canApprove()) {
        useOfficeStore.getState().record('Discount above 10% was refused')
        return state
      }
      return { options: { ...state.options, ...partial } }
    }),
  applySystem: (entry) =>
    set((state) =>
      withHistory(
        state,
        {
          materials: { ...state.materials, ...entry.materials },
          options: { ...state.options, ...entry.options },
        },
        true,
      ),
    ),
  addWall: (wall) =>
    set((state) => withHistory(state, { walls: [...state.walls, wall], selection: { type: 'wall', id: wall.id } }, true)),
  setWalls: (walls, history = true) =>
    set((state) => withHistory(state, seat(walls, state.items, state.openings, state.fixtures), history)),
  updateWall: (id, partial, history = true) =>
    set((state) => {
      const walls = state.walls.map((wall) => (wall.id === id ? { ...wall, ...partial } : wall))
      return withHistory(state, seat(walls, state.items, state.openings, state.fixtures), history)
    }),
  addOpening: (opening) =>
    set((state) => withHistory(state, { openings: [...state.openings, opening], selection: { type: 'opening', id: opening.id } }, true)),
  updateOpening: (id, partial, history = true) =>
    set((state) => ({
      ...withHistory(
        state,
        {
          openings: state.openings.map((opening) => {
            if (opening.id !== id) return opening
            const next = { ...opening, ...partial }
            const wall = state.walls.find((entry) => entry.id === next.wallId)
            return wall ? clampOpening(next, wall) : next
          }),
        },
        history,
      ),
    })),
  addFixture: (fixture) =>
    set((state) => withHistory(state, { fixtures: [...state.fixtures, fixture], selection: { type: 'fixture', id: fixture.id } }, true)),
  updateFixture: (id, partial, history = true) =>
    set((state) =>
      withHistory(
        state,
        { fixtures: state.fixtures.map((fixture) => (fixture.id === id ? { ...fixture, ...partial } : fixture)) },
        history,
      ),
    ),
  addItem: (item) => set((state) => withHistory(state, { items: [...state.items, item], selection: { type: 'item', id: item.id } }, true)),
  updateItem: (id, partial, history = true) =>
    set((state) => {
      const items = state.items.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...partial }
        if (partial.depth != null && item.wallId) {
          const wall = state.walls.find((entry) => entry.id === item.wallId)
          if (wall) return reseatItem(next, wall, state.walls)
        }
        return next
      })
      return withHistory(state, { items }, history)
    }),
  replaceItems: (items, history = true) => set((state) => withHistory(state, { items }, history)),
  setSelection: (selection) => set({ selection, inspectorTab: selection ? 'object' : get().inspectorTab }),
  deleteSelection: () =>
    set((state) => {
      const selection = state.selection
      if (!selection) return state
      if (selection.type === 'wall') {
        return withHistory(
          state,
          {
            walls: state.walls.filter((wall) => wall.id !== selection.id),
            openings: state.openings.filter((opening) => opening.wallId !== selection.id),
            items: state.items.map((item) => (item.wallId === selection.id ? { ...item, wallId: undefined } : item)),
            fixtures: state.fixtures.map((fixture) => (fixture.wallId === selection.id ? { ...fixture, wallId: undefined } : fixture)),
            selection: null,
          },
          true,
        )
      }
      if (selection.type === 'opening') return withHistory(state, { openings: state.openings.filter((opening) => opening.id !== selection.id), selection: null }, true)
      if (selection.type === 'fixture') return withHistory(state, { fixtures: state.fixtures.filter((fixture) => fixture.id !== selection.id), selection: null }, true)
      return withHistory(
        state,
        {
          items: state.items.filter((item) => item.id !== selection.id && item.hostId !== selection.id),
          selection: null,
        },
        true,
      )
    }),
  setHanding: (id, handing) => get().updateItem(id, { handing }),
  setFrontsOpen: (degrees) =>
    set((state) => withHistory(state, { items: state.items.map((item) => ({ ...item, open: degrees })) }, true)),
  undo: () =>
    set((state) => {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return { ...state, ...clone(prev), past: state.past.slice(0, -1), future: [...state.future, snapshotOf(state)], selection: null, gesturing: false }
    }),
  redo: () =>
    set((state) => {
      const next = state.future[state.future.length - 1]
      if (!next) return state
      return { ...state, ...clone(next), future: state.future.slice(0, -1), past: [...state.past, snapshotOf(state)], selection: null, gesturing: false }
    }),
  resetDesign: () => set({ ...createSeed(), selection: null, past: [], future: [], gesturing: false, tool: 'select' }),
  loadDocument: (data) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid document')
    const record = data as Partial<DesignSnapshot>
    if (!Array.isArray(record.walls) || !Array.isArray(record.items)) throw new Error('Invalid document')
    const seed = createSeed()
    set({
      ...seed,
      ...record,
      materials: { ...seed.materials, ...record.materials },
      options: { ...seed.options, ...record.options },
      client: { ...seed.client, ...record.client },
      status: record.status ?? seed.status,
      statusHistory: record.statusHistory ?? seed.statusHistory,
      revision: record.revision ?? 1,
      locked: record.locked ?? false,
      lead: { ...seed.lead, ...record.lead },
      comments: record.comments ?? [],
      documents: record.documents ?? [],
      surveyNotes: record.surveyNotes ?? '',
      walls: record.walls,
      openings: record.openings ?? [],
      fixtures: record.fixtures ?? [],
      items: record.items.map((item) => ({ open: 0, ...item })),
      selection: null,
      past: [],
      future: [],
      gesturing: false,
    })
  },
  setStatus: (status) =>
    set((state) => {
      const by = useOfficeStore.getState().current().name
      useOfficeStore.getState().record(`Status set to ${status}`)
      return { status, statusHistory: [...state.statusHistory, { at: new Date().toISOString(), by, status }] }
    }),
  lockRevision: () =>
    set((state) => {
      if (!canApprove()) return state
      useOfficeStore.getState().record(`Locked revision ${state.revision}`)
      return { locked: true }
    }),
  openRevision: () =>
    set((state) => {
      if (!canApprove()) return state
      useOfficeStore.getState().record(`Opened revision ${state.revision + 1}`)
      return { locked: false, revision: state.revision + 1 }
    }),
  setLead: (lead) => set((state) => ({ lead: { ...state.lead, ...lead } })),
  setSurveyNotes: (surveyNotes) => set({ surveyNotes }),
  addComment: (text) =>
    set((state) => ({
      comments: [...state.comments, { id: uid('note'), at: new Date().toISOString(), by: useOfficeStore.getState().current().name, text }],
    })),
  addDocument: (document) => set((state) => ({ documents: [...state.documents, document] })),
  duplicateProject: () =>
    set((state) => ({
      projectName: `${state.projectName} copy`,
      status: 'enquiry',
      statusHistory: [{ at: new Date().toISOString(), by: useOfficeStore.getState().current().name, status: 'enquiry' }],
      revision: 1,
      locked: false,
      comments: [],
      past: [],
      future: [],
    })),
}))

export function persistDesign() {
  const state = useDesignStore.getState()
  const payload = { v: 1, view: state.view, showDimensions: state.showDimensions, ...snapshotOf(state) }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function downloadDesign() {
  const state = useDesignStore.getState()
  const blob = new Blob([JSON.stringify({ v: 1, view: state.view, showDimensions: state.showDimensions, ...snapshotOf(state) }, null, 2)], {
    type: 'application/json',
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${state.projectName.replace(/\s+/g, '-').toLowerCase() || 'kitchen'}.winner`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function specOf(sku: string) {
  return catalogBySku[sku]
}
