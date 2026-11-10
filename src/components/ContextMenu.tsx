import { catalogBySku } from '../catalog'
import { designWarnings } from '../lib/checks'
import { useDesignStore } from '../store/useDesignStore'
import type { Selection } from '../types'
import { create } from 'zustand'

interface MenuState {
  menu: { x: number; y: number; selection: Selection | null } | null
  open: (x: number, y: number, selection: Selection | null) => void
  close: () => void
}

export const useContextMenu = create<MenuState>((set) => ({
  menu: null,
  open: (x, y, selection) => set({ menu: { x, y, selection } }),
  close: () => set({ menu: null }),
}))

export function openContextMenu(x: number, y: number, selection: Selection | null) {
  useContextMenu.getState().open(x, y, selection)
}

export function ContextMenu() {
  const menu = useContextMenu((state) => state.menu)
  if (!menu) return null
  const store = useDesignStore.getState()
  const close = () => useContextMenu.getState().close()
  const actions = actionsFor(menu.selection, store)
  return (
    <div className="fixed inset-0 z-50" onPointerDown={close} onContextMenu={(event) => event.preventDefault()}>
      <div
        className="absolute min-w-52 rounded-md border border-white/10 bg-[#262b33] py-1 text-sm shadow-xl"
        style={{ left: menu.x, top: menu.y }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            className="block w-full px-3 py-1.5 text-left text-white/85 hover:bg-winner"
            onClick={() => {
              action.run()
              close()
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function actionsFor(selection: Selection | null, store: ReturnType<typeof useDesignStore.getState>) {
  if (!selection) {
    return [{ label: 'Room properties', run: () => store.setInspectorTab('object') }]
  }
  if (selection.type === 'wall') {
    const wall = store.walls.find((entry) => entry.id === selection.id)
    return [
      { label: 'Paint and tiles', run: () => store.setInspectorTab('finish') },
      { label: 'Wall height', run: () => store.setInspectorTab('object') },
      {
        label: 'Follow roof',
        run: () => wall && store.updateWall(wall.id, { heightA: undefined, heightB: undefined }),
      },
    ]
  }
  if (selection.type === 'item') {
    const item = store.items.find((entry) => entry.id === selection.id)
    const spec = item ? catalogBySku[item.sku] : undefined
    const warning = item ? designWarnings(store.items, store.walls, store.fixtures).find((entry) => entry.itemId === item.id) : undefined
    return [
      { label: 'Size and handing', run: () => store.setInspectorTab('object') },
      { label: spec && ['hob', 'oven', 'oven-tower'].includes(spec.style) ? 'Service clearance' : 'Finish', run: () => store.setInspectorTab(spec && ['hob', 'oven', 'oven-tower'].includes(spec.style) ? 'object' : 'finish') },
      { label: warning ? warning.message : 'No clearance warning', run: () => store.setInspectorTab('object') },
    ]
  }
  return [{ label: 'Properties', run: () => store.setInspectorTab('object') }]
}
