import { fitPlan, zoomPlan } from '../plan/camera'
import { useDesignStore } from '../store/useDesignStore'
import type { Tool } from '../types'

const GROUPS: { label: string; tools: { id: Tool | 'undo' | 'redo' | 'delete' | 'fit' | 'zoom-in' | 'zoom-out' | 'dims'; label: string; hint: string }[] }[] = [
  {
    label: 'Edit',
    tools: [
      { id: 'undo', label: 'Undo', hint: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', hint: 'Ctrl+Y' },
      { id: 'delete', label: 'Delete', hint: 'Del' },
    ],
  },
  {
    label: 'Draw',
    tools: [
      { id: 'select', label: 'Select', hint: 'V' },
      { id: 'wall', label: 'Wall', hint: 'W' },
      { id: 'pan', label: 'Pan', hint: 'Space' },
    ],
  },
  {
    label: 'Openings',
    tools: [
      { id: 'door', label: 'Door', hint: 'D' },
      { id: 'window', label: 'Window', hint: 'N' },
      { id: 'niche', label: 'Niche', hint: 'H' },
    ],
  },
  {
    label: 'Structure',
    tools: [
      { id: 'pillar', label: 'Pillar', hint: 'P' },
      { id: 'beam', label: 'Beam', hint: 'M' },
      { id: 'chimney', label: 'Chimney', hint: 'C' },
      { id: 'pipe', label: 'Pipe', hint: 'I' },
    ],
  },
  {
    label: 'View',
    tools: [
      { id: 'fit', label: 'Fit', hint: 'F' },
      { id: 'zoom-in', label: 'Zoom +', hint: '+' },
      { id: 'zoom-out', label: 'Zoom -', hint: '-' },
      { id: 'dims', label: 'Dims', hint: 'Measures' },
      { id: 'measure', label: 'Measure', hint: 'E' },
    ],
  },
]

export function Toolbar() {
  const tool = useDesignStore((state) => state.tool)
  const showDimensions = useDesignStore((state) => state.showDimensions)
  const thickness = useDesignStore((state) => state.defaultThickness)
  const active = (id: string) => (id === 'dims' ? showDimensions : tool === id)

  return (
    <div className="flex h-22 items-stretch gap-1 border-b border-white/10 bg-shell px-2">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col justify-center border-r border-white/10 px-1">
          <div className="flex items-stretch gap-0.5">
            {group.tools.map((entry) => (
              <button
                key={entry.id}
                title={entry.hint}
                onClick={() => runTool(entry.id)}
                className={`flex w-13.5 flex-col items-center justify-center gap-1 rounded py-1 ${active(entry.id) ? 'bg-winner text-white' : 'text-white/75 hover:bg-white/10'}`}
              >
                <ToolGlyph id={entry.id} />
                <span className="text-[10px] leading-none tracking-wide">{entry.label}</span>
              </button>
            ))}
          </div>
          <div className="pt-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-white/35">{group.label}</div>
        </div>
      ))}
      <label className="ml-2 flex flex-col justify-center gap-1 text-[10px] uppercase tracking-wider text-white/45">
        Wall thickness
        <select
          value={thickness}
          onChange={(event) => {
            const value = Number(event.target.value)
            const state = useDesignStore.getState()
            useDesignStore.setState({ defaultThickness: value })
            if (state.selection?.type === 'wall') state.updateWall(state.selection.id, { thickness: value })
          }}
          className="rounded border border-white/10 bg-shell-deep px-2 py-1 text-xs normal-case tracking-normal text-white"
        >
          {[100, 150, 200, 215, 250, 300].map((value) => (
            <option key={value} value={value}>
              {value} mm
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function runTool(id: string) {
  const store = useDesignStore.getState()
  if (id === 'undo') return store.undo()
  if (id === 'redo') return store.redo()
  if (id === 'delete') return store.deleteSelection()
  if (id === 'fit') return fitPlan()
  if (id === 'zoom-in') return zoomPlan(1.15)
  if (id === 'zoom-out') return zoomPlan(1 / 1.15)
  if (id === 'dims') return store.setShowDimensions(!store.showDimensions)
  if (id === 'measure') {
    store.setShowDimensions(true)
    store.setTool('measure')
    return
  }
  store.setTool(id as Tool)
}

function ToolGlyph({ id }: { id: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      {id === 'select' && <path d="M5 4l6 15 2-6 6-2z" />}
      {id === 'wall' && <path d="M4 18V6h6v12M14 18V9h6v9M4 18h16" />}
      {id === 'pan' && <path d="M12 3v18M3 12h18M7 7l-4 5 4 5M17 7l4 5-4 5" />}
      {id === 'door' && <path d="M7 20V5h8a6 6 0 0 1 0 12H7" />}
      {id === 'window' && <path d="M4 5h16v14H4zM12 5v14M4 12h16" />}
      {id === 'niche' && <path d="M5 5h14v14H5zM8 9h8v6H8z" />}
      {id === 'pillar' && <path d="M8 4h8v3H8zM9 7h6v13H9z" />}
      {id === 'beam' && <path d="M3 9h18v3H3zM6 12v3M18 12v3" strokeDasharray="2 2" />}
      {id === 'chimney' && <path d="M8 20V9l4-4 4 4v11M10 4.5c.5-2 3-2 3.5 0" />}
      {id === 'pipe' && <path d="M12 3v18M8 7a4 4 0 0 1 8 0M8 17a4 4 0 0 0 8 0" />}
      {id === 'undo' && <path d="M8 8H4v4M4.5 8A8 8 0 1 1 6 17" />}
      {id === 'redo' && <path d="M16 8h4v4M19.5 8A8 8 0 1 0 18 17" />}
      {id === 'delete' && <path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" />}
      {id === 'fit' && <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      {id === 'zoom-in' && <path d="M11 6a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM15.5 15.5L20 20M11 8v6M8 11h6" />}
      {id === 'zoom-out' && <path d="M11 6a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM15.5 15.5L20 20M8 11h6" />}
      {id === 'dims' && <path d="M4 17h16M7 17v-3M17 17v-3M8 8h8M8 8v3M16 8v3" />}
      {id === 'measure' && <path d="M4 16h16M6 16v-3M18 16v-3M5 8h14M7 8v4M17 8v4" />}
    </svg>
  )
}
