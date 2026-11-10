import type { DesignSnapshot, Fixture, Opening, Wall } from '../types'
import { useDesignStore } from '../store/useDesignStore'

const BACKUP_A = 'winner-design-backup-a'
const BACKUP_B = 'winner-design-backup-b'
const TRASH = 'winner-design-trash'

export interface RoomFile {
  ceiling: number
  walls: Wall[]
  openings: Opening[]
  fixtures: Fixture[]
}

export function roomFileOf(state: DesignSnapshot): RoomFile {
  return { ceiling: state.options.ceiling, walls: state.walls, openings: state.openings, fixtures: state.fixtures }
}

export function downloadRoomFile() {
  const state = useDesignStore.getState()
  const blob = new Blob([JSON.stringify(roomFileOf(state), null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${state.projectName.replace(/\s+/g, '-').toLowerCase() || 'room'}-room.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function applyRoomFile(data: unknown) {
  if (!data || typeof data !== 'object') throw new Error('Room file must be a JSON object')
  const record = data as Partial<RoomFile>
  if (!Array.isArray(record.walls)) throw new Error('Room file needs a walls array')
  const store = useDesignStore.getState()
  store.setWalls(record.walls as Wall[])
  useDesignStore.setState({
    openings: (record.openings as Opening[]) ?? [],
    fixtures: (record.fixtures as Fixture[]) ?? [],
  })
  if (typeof record.ceiling === 'number') store.patchOptions({ ceiling: record.ceiling })
}

export function writeBackup() {
  const raw = localStorage.getItem('winner-design-document-v1')
  if (!raw) return
  const previous = localStorage.getItem(BACKUP_A)
  if (previous) localStorage.setItem(BACKUP_B, previous)
  localStorage.setItem(BACKUP_A, raw)
}

export function readBackup(slot: 'a' | 'b') {
  return localStorage.getItem(slot === 'a' ? BACKUP_A : BACKUP_B)
}

export function trashProject() {
  const state = useDesignStore.getState()
  const raw = localStorage.getItem(TRASH)
  const list = raw ? (JSON.parse(raw) as { at: string; name: string; doc: string }[]) : []
  list.unshift({ at: new Date().toISOString(), name: state.projectName, doc: JSON.stringify(state) })
  localStorage.setItem(TRASH, JSON.stringify(list.slice(0, 8)))
  state.resetDesign()
}

export function trashEntries() {
  try {
    const raw = localStorage.getItem(TRASH)
    if (!raw) return [] as { at: string; name: string; doc: string }[]
    return JSON.parse(raw) as { at: string; name: string; doc: string }[]
  } catch {
    return []
  }
}

export function restoreTrash(index: number) {
  const list = trashEntries()
  const entry = list[index]
  if (!entry) return
  useDesignStore.getState().loadDocument(JSON.parse(entry.doc))
}

export function purgeTrash() {
  localStorage.removeItem(TRASH)
}

/** Reads wall, door, and window polylines from a text IFC file. Other entities are counted and ignored. */
export function roomFromIfc(text: string): { room: RoomFile; ignored: number } {
  const points = new Map<number, { x: number; y: number }>()
  const pointRe = /#(\d+)\s*=\s*IFCCARTESIANPOINT\s*\(\(\s*([^)]+)\)\)/gi
  for (const match of text.matchAll(pointRe)) {
    const nums = match[2].split(',').map((value) => Number(value))
    if (nums.length >= 2 && nums.every((value) => Number.isFinite(value))) {
      points.set(Number(match[1]), { x: Math.round(nums[0] * 1000), y: Math.round(nums[1] * 1000) })
    }
  }
  const polylines = new Map<number, { x: number; y: number }[]>()
  const lineRe = /#(\d+)\s*=\s*IFCPOLYLINE\s*\(\(([^)]*)\)\)/gi
  for (const match of text.matchAll(lineRe)) {
    const ids = match[2].split(',').map((value) => Number(value.replace('#', '').trim()))
    const ring = ids.flatMap((id) => {
      const point = points.get(id)
      return point ? [point] : []
    })
    if (ring.length >= 2) polylines.set(Number(match[1]), ring)
  }
  const walls: Wall[] = []
  const openings: Opening[] = []
  let ignored = 0
  const entityRe = /#\d+\s*=\s*IFC([A-Z0-9]+)\s*\(([^;]*)\);/gi
  for (const match of text.matchAll(entityRe)) {
    const kind = match[1]
    const body = match[2]
    if (kind === 'CARTESIANPOINT' || kind === 'POLYLINE') continue
    if (kind.startsWith('WALL')) {
      const refs = [...body.matchAll(/#(\d+)/g)].map((ref) => Number(ref[1]))
      const ring = refs.map((id) => polylines.get(id)).find((entry) => entry && entry.length >= 2)
      if (ring && ring.length >= 2) {
        walls.push({ id: `ifc-wall-${walls.length + 1}`, a: ring[0], b: ring[ring.length - 1], thickness: 150 })
      } else ignored += 1
      continue
    }
    if (kind === 'DOOR' || kind === 'WINDOW') {
      const wall = walls[walls.length - 1]
      if (!wall) {
        ignored += 1
        continue
      }
      openings.push({
        id: `ifc-${kind.toLowerCase()}-${openings.length + 1}`,
        wallId: wall.id,
        type: kind === 'DOOR' ? 'door' : 'window',
        offset: 900 + openings.length * 200,
        width: kind === 'DOOR' ? 860 : 1200,
        height: kind === 'DOOR' ? 2040 : 1200,
        sill: kind === 'DOOR' ? 0 : 900,
        flip: false,
      })
      continue
    }
    ignored += 1
  }
  if (!walls.length) throw new Error('No IFC wall polylines were found. Export the room as JSON instead.')
  return { room: { ceiling: 2400, walls, openings, fixtures: [] }, ignored }
}
