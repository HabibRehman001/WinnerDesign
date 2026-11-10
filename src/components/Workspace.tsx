import { FloorPlan } from '../plan/FloorPlan'
import { useDesignStore } from '../store/useDesignStore'
import { ElevationView } from '../viewport/ElevationView'
import { Scene3D } from '../viewport/Scene3D'

const TABS = [
  ['plan', '2D Floor Plan'],
  ['3d', '3D Render'],
  ['elevation', 'Elevation'],
  ['split', 'Split View'],
  ['walk', 'Walkthrough'],
] as const

export function Workspace() {
  const view = useDesignStore((state) => state.view)
  const showPlan = view === 'plan' || view === 'split'
  const showElevation = view === 'elevation'
  const show3d = view === '3d' || view === 'split' || view === 'walk'

  return (
    <section className="flex min-w-60 flex-1 flex-col bg-shell">
      <div className="flex h-9 items-end gap-1 px-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => useDesignStore.getState().setView(id)}
            className={`rounded-t px-3 py-1.5 text-[12px] ${view === id ? 'bg-winner text-white' : 'text-white/60 hover:bg-white/5'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        {showPlan && (
          <div className={view === 'split' ? 'absolute inset-y-0 left-0 w-1/2 border-r border-[#c5cad3]' : 'absolute inset-0'}>
            <FloorPlan />
          </div>
        )}
        {showElevation && (
          <div className="absolute inset-0">
            <ElevationView />
          </div>
        )}
        <div
          className={
            show3d
              ? view === 'split'
                ? 'absolute inset-y-0 right-0 w-1/2'
                : 'absolute inset-0'
              : 'pointer-events-none invisible absolute inset-0'
          }
        >
          <Scene3D mode={view === 'walk' ? 'walk' : 'orbit'} />
          {view === 'walk' && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-ink/85 px-3 py-1.5 text-xs text-white">
              Drag to look · WASD walk · Shift run
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
