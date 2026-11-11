import { useEffect, useState, type ReactNode } from 'react'
import { catalogBySku } from '../catalog'
import { nearestCornerPose } from '../lib/corners'
import { downloadDesign, persistDesign, useDesignStore } from '../store/useDesignStore'
import { fitPlan } from '../plan/camera'
import { norm, sub } from '../lib/geometry'
import { writeBackup } from '../lib/projectFiles'
import { CatalogPanel } from './CatalogPanel'
import { ContextMenu } from './ContextMenu'
import { InspectorPanel } from './InspectorPanel'
import { OfficePanel } from './OfficePanel'
import { StatusBar } from './StatusBar'
import { Toolbar } from './Toolbar'
import { Workspace } from './Workspace'

export function AppShell() {
  const [left, setLeft] = useState(280)
  const [right, setRight] = useState(320)
  const [about, setAbout] = useState(false)
  const [office, setOffice] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const projectName = useDesignStore((state) => state.projectName)
  const view = useDesignStore((state) => state.view)
  const comments = useDesignStore((state) => state.comments)

  useEffect(() => {
    const timer = window.setInterval(() => writeBackup(), 10 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    return window.winner?.onOpenProject((text) => {
      try {
        useDesignStore.getState().loadDocument(JSON.parse(text))
        fitPlan()
      } catch {
        window.alert('That file is not a Winner Design document.')
      }
    })
  }, [])

  useEffect(() => {
    let timer = 0
    const unsubscribe = useDesignStore.subscribe((state, previous) => {
      if (
        state.walls === previous.walls &&
        state.items === previous.items &&
        state.openings === previous.openings &&
        state.fixtures === previous.fixtures &&
        state.materials === previous.materials &&
        state.options === previous.options &&
        state.client === previous.client &&
        state.projectName === previous.projectName &&
        state.view === previous.view &&
        state.showDimensions === previous.showDimensions &&
        state.defaultThickness === previous.defaultThickness
      ) {
        return
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => persistDesign(), 250)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }
      const store = useDesignStore.getState()
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault()
        store.redo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault()
        downloadDesign()
        writeBackup()
        return
      }
      if (event.key === 'F5') {
        event.preventDefault()
        document.getElementById('catalog-search')?.focus()
        return
      }
      if (event.key === 'F2') {
        event.preventDefault()
        store.setSelection(null)
        store.setInspectorTab('object')
        return
      }
      if (event.key.startsWith('Arrow') && store.selection?.type === 'item') {
        event.preventDefault()
        nudgeSelection(event.key, event.shiftKey ? 10 : 1)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        store.deleteSelection()
        return
      }
      if (event.key === 'Escape') {
        store.setSelection(null)
        return
      }
      if (key === 'v') store.setTool('select')
      if (key === 'w') store.setTool('wall')
      if (key === 'd') store.setTool('door')
      if (key === 'n') store.setTool('window')
      if (key === 'h') store.setTool('niche')
      if (key === 'p') store.setTool('pillar')
      if (key === 'm') store.setTool('beam')
      if (key === 'c') store.setTool('chimney')
      if (key === 'i') store.setTool('pipe')
      if (key === 'e') {
        store.setShowDimensions(true)
        store.setTool('measure')
      }
      if (key === 'f') fitPlan()
      if (event.key === '1') store.setView('plan')
      if (event.key === '2') store.setView('3d')
      if (event.key === '3') store.setView('elevation')
      if (event.key === '4') store.setView('split')
      if (event.key === '5') store.setView('walk')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col bg-shell-deep text-white">
      <header className="flex h-11 items-center gap-3 border-b border-white/10 bg-shell px-2">
        <div className="flex items-center gap-2 pr-2">
          <div className="grid h-7 w-7 place-items-center rounded-sm bg-winner text-sm font-bold">W</div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-wide">Winner Design</div>
            <div className="text-[10px] text-white/45">Kitchen & Bathroom CAD</div>
          </div>
        </div>
        <TopMenu
          onAbout={() => setAbout(true)}
          onOffice={() => setOffice(true)}
          onPresent={() => {
            useDesignStore.getState().setView('3d')
            setPresenting(true)
          }}
          onNew={() => {
            if (window.confirm('Replace the current drawing with a new sample kitchen?')) {
              useDesignStore.getState().resetDesign()
              fitPlan()
            }
          }}
        />
        <input
          value={projectName}
          onChange={(event) => useDesignStore.getState().setProjectName(event.target.value)}
          className="ml-2 w-56 bg-transparent text-sm outline-none placeholder:text-white/30"
        />
        <div className="ml-auto pr-2 text-[10px] uppercase tracking-[0.18em] text-white/40">{viewLabel(view)}</div>
      </header>
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {!presenting && <CatalogPanel width={left} />}
        {!presenting && (
          <Splitter
            onDrag={(delta, start) => setLeft(Math.min(420, Math.max(220, start + delta)))}
            start={left}
          />
        )}
        <Workspace />
        {!presenting && (
          <Splitter
            onDrag={(delta, start) => setRight(Math.min(460, Math.max(260, start - delta)))}
            start={right}
          />
        )}
        {!presenting && <InspectorPanel width={right} />}
      </div>
      <StatusBar />
      <ContextMenu />
      {presenting && (
        <div className="fixed bottom-12 left-1/2 z-40 w-[min(36rem,90vw)] -translate-x-1/2 rounded-md bg-ink/90 p-3 text-sm">
          <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-white/50">
            <span>Presentation</span>
            <button onClick={() => setPresenting(false)}>Close</button>
          </div>
          <ul className="max-h-24 overflow-auto text-white/80">
            {comments.length === 0 && <li>No customer comments yet.</li>}
            {comments.map((entry) => (
              <li key={entry.id}>{entry.by}: {entry.text}</li>
            ))}
          </ul>
        </div>
      )}
      {office && <OfficePanel onClose={() => setOffice(false)} />}
      {about && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6" onClick={() => setAbout(false)}>
          <div className="max-w-lg rounded-md bg-shell p-5 text-sm shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="text-base font-semibold">Winner Design</div>
            <p className="mt-2 text-white/70">
              Kitchen and bathroom CAD workspace. Draw walls, drop parametric units, and keep the plan, elevation, and 3D model in sync.
            </p>
            <ul className="mt-3 space-y-1 text-white/80">
              <li>V select · W wall · D door · N window · H niche</li>
              <li>P pillar · M beam · C chimney · I service pipe · F fit view</li>
              <li>Click a cabinet in 3D to swing the door, flap, or drawer</li>
              <li>F5 catalogue · F2 room · arrows nudge 1 mm · Shift+arrows 10 mm</li>
              <li>Wheel zoom · middle mouse or Space pan · orange handles resize width</li>
              <li>Ctrl+Z undo · Ctrl+S save JSON · Delete removes the selection</li>
            </ul>
            <button className="mt-4 rounded bg-winner px-3 py-1.5" onClick={() => setAbout(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function nudgeSelection(key: string, step: number) {
  const store = useDesignStore.getState()
  if (store.selection?.type !== 'item') return
  const item = store.items.find((entry) => entry.id === store.selection?.id)
  if (!item) return
  const wall = store.walls.find((entry) => entry.id === item.wallId)
  let dx = 0
  let dy = 0
  if (wall) {
    const along = norm(sub(wall.b, wall.a))
    if (key === 'ArrowRight') {
      dx = along.x * step
      dy = along.y * step
    }
    if (key === 'ArrowLeft') {
      dx = -along.x * step
      dy = -along.y * step
    }
    if (key === 'ArrowUp') {
      dx = -along.y * step
      dy = along.x * step
    }
    if (key === 'ArrowDown') {
      dx = along.y * step
      dy = -along.x * step
    }
  } else {
    if (key === 'ArrowLeft') dx = -step
    if (key === 'ArrowRight') dx = step
    if (key === 'ArrowUp') dy = -step
    if (key === 'ArrowDown') dy = step
  }
  const next = { x: item.x + dx, y: item.y + dy }
  const spec = catalogBySku[item.sku]
  if (spec && (spec.style === 'corner' || spec.style === 'carousel')) {
    const snapped = nearestCornerPose({ ...item, ...next }, { width: item.width, depth: item.depth }, store.walls)
    if (snapped) {
      store.updateItem(item.id, snapped)
      return
    }
  }
  store.updateItem(item.id, next)
}

function viewLabel(view: string) {
  if (view === 'plan') return '2D floor plan'
  if (view === '3d') return '3D render'
  if (view === 'elevation') return 'Elevation'
  if (view === 'walk') return 'Walkthrough'
  return 'Split view'
}

function TopMenu({ onNew, onAbout, onOffice, onPresent }: { onNew: () => void; onAbout: () => void; onOffice: () => void; onPresent: () => void }) {
  return (
    <nav className="flex items-center gap-1 text-[13px] text-white/80">
      <Menu label="File">
        <MenuItem onClick={onNew}>New sample room</MenuItem>
        <MenuItem onClick={() => downloadDesign()}>Save JSON</MenuItem>
        <MenuItem onClick={onOffice}>Office, survey, recovery</MenuItem>
        <MenuItem onClick={() => document.getElementById('winner-open')?.click()}>Open JSON</MenuItem>
      </Menu>
      <Menu label="Edit">
        <MenuItem onClick={() => useDesignStore.getState().undo()}>Undo</MenuItem>
        <MenuItem onClick={() => useDesignStore.getState().redo()}>Redo</MenuItem>
        <MenuItem onClick={() => useDesignStore.getState().deleteSelection()}>Delete</MenuItem>
      </Menu>
      <Menu label="View">
        <MenuItem onClick={() => useDesignStore.getState().setView('plan')}>2D floor plan</MenuItem>
        <MenuItem onClick={() => useDesignStore.getState().setView('3d')}>3D render</MenuItem>
        <MenuItem onClick={() => useDesignStore.getState().setView('elevation')}>Elevation</MenuItem>
        <MenuItem onClick={() => useDesignStore.getState().setView('split')}>Split view</MenuItem>
        <MenuItem onClick={() => useDesignStore.getState().setView('walk')}>Walkthrough</MenuItem>
        <MenuItem onClick={onPresent}>Present</MenuItem>
        <MenuItem onClick={() => useDesignStore.getState().setShowDimensions(!useDesignStore.getState().showDimensions)}>Toggle dimensions</MenuItem>
      </Menu>
      <button className="rounded px-2 py-1 hover:bg-white/10" onClick={onAbout}>
        Help
      </button>
      <input
        id="winner-open"
        type="file"
        accept=".winner,.json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            try {
              useDesignStore.getState().loadDocument(JSON.parse(String(reader.result)))
              fitPlan()
            } catch {
              window.alert('That file is not a Winner Design document.')
            }
          }
          reader.readAsText(file)
        }}
      />
    </nav>
  )
}

function Menu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button className="rounded px-2 py-1 hover:bg-white/10" onClick={() => setOpen((value) => !value)}>
        {label}
      </button>
      {open && <div className="absolute left-0 top-full z-40 min-w-48 rounded-md border border-white/10 bg-[#262b33] py-1 shadow-xl">{children}</div>}
    </div>
  )
}

function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="block w-full px-3 py-1.5 text-left text-[13px] text-white/85 hover:bg-winner"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Splitter({ start, onDrag }: { start: number; onDrag: (delta: number, start: number) => void }) {
  return (
    <div
      className="w-1 cursor-col-resize bg-[#15181d] hover:bg-winner"
      onPointerDown={(event) => {
        const origin = event.clientX
        const width = start
        const move = (ev: PointerEvent) => onDrag(ev.clientX - origin, width)
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
      onDoubleClick={() => onDrag(0, start > 300 ? 320 : 280)}
    />
  )
}
