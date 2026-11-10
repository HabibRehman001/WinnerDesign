import { useMemo } from 'react'
import { DOOR_STYLES, WORKTOPS, catalogBySku } from '../catalog'
import { designWarnings } from '../lib/checks'
import { LIGHT_PRESETS } from '../lib/lighting'
import { offsetLoop, orderedLoop, polygonAreaM2, wallLength } from '../lib/geometry'
import { buildQuote, money } from '../lib/pricing'
import { RENDER_SIZES, exportRender } from '../lib/renderExport'
import { exportInstallerPack, exportQuotation, exportSupplierOrder } from '../lib/quotePdf'
import { canSeeCost } from '../store/useOfficeStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { uid, useDesignStore } from '../store/useDesignStore'
import type { CurrencyCode, DoorStyle, HandlePlacement, RoofStyle, WorktopFinish } from '../types'

export function InspectorPanel({ width }: { width: number }) {
  const tab = useDesignStore((state) => state.inspectorTab)
  return (
    <aside className="flex min-w-45 shrink flex-col border-l border-white/10 bg-shell" style={{ width, flexBasis: width }}>
      <div className="flex border-b border-white/10">
        {(['object', 'finish', 'quote'] as const).map((id) => (
          <button
            key={id}
            onClick={() => useDesignStore.getState().setInspectorTab(id)}
            className={`flex-1 py-2 text-[11px] uppercase tracking-[0.14em] ${tab === id ? 'bg-winner text-white' : 'text-white/55 hover:bg-white/5'}`}
          >
            {id === 'object' ? 'Object' : id === 'finish' ? 'Finish' : 'Quote'}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === 'object' && <ObjectTab />}
        {tab === 'finish' && <FinishTab />}
        {tab === 'quote' && <QuoteTab />}
      </div>
    </aside>
  )
}

function ObjectTab() {
  const selection = useDesignStore((state) => state.selection)
  const walls = useDesignStore((state) => state.walls)
  const openings = useDesignStore((state) => state.openings)
  const fixtures = useDesignStore((state) => state.fixtures)
  const items = useDesignStore((state) => state.items)
  const options = useDesignStore((state) => state.options)
  if (selection?.type === 'wall') {
    const wall = walls.find((entry) => entry.id === selection.id)
    if (!wall) return null
    return (
      <div className="space-y-3">
        <Header kicker="Wall" title={formatTitle(wallLength(wall))} />
        <NumberField label="Thickness" value={wall.thickness} min={100} max={300} onChange={(value) => useDesignStore.getState().updateWall(wall.id, { thickness: value }, false)} />
        <NumberField label="Height at start" value={wall.heightA ?? options.ceiling} min={900} max={4200} onChange={(value) => useDesignStore.getState().updateWall(wall.id, { heightA: value }, false)} />
        <NumberField label="Height at end" value={wall.heightB ?? options.ceiling} min={900} max={4200} onChange={(value) => useDesignStore.getState().updateWall(wall.id, { heightB: value }, false)} />
        <button className="w-full rounded bg-white/10 py-1.5 text-xs" onClick={() => useDesignStore.getState().updateWall(wall.id, { heightA: undefined, heightB: undefined })}>
          Follow roof
        </button>
        <Readout label="Length" value={`${Math.round(wallLength(wall))} mm`} />
        <DeleteButton />
      </div>
    )
  }
  if (selection?.type === 'opening') {
    const opening = openings.find((entry) => entry.id === selection.id)
    if (!opening) return null
    return (
      <div className="space-y-3">
        <Header kicker="Opening" title={opening.type} />
        <NumberField label="Width" value={opening.width} min={300} max={2400} onChange={(value) => useDesignStore.getState().updateOpening(opening.id, { width: value }, false)} />
        <NumberField label="Height" value={opening.height} min={300} max={2400} onChange={(value) => useDesignStore.getState().updateOpening(opening.id, { height: value }, false)} />
        <NumberField label="Sill" value={opening.sill} min={0} max={1600} onChange={(value) => useDesignStore.getState().updateOpening(opening.id, { sill: value }, false)} />
        {opening.type === 'door' && (
          <Toggle
            label="Hinge"
            value={opening.flip ? 'Right' : 'Left'}
            onClick={() => useDesignStore.getState().updateOpening(opening.id, { flip: !opening.flip })}
          />
        )}
        <DeleteButton />
      </div>
    )
  }
  if (selection?.type === 'fixture') {
    const fixture = fixtures.find((entry) => entry.id === selection.id)
    if (!fixture) return null
    return (
      <div className="space-y-3">
        <Header kicker="Structure" title={fixture.type} />
        <NumberField label="Width" value={fixture.width} min={100} max={2000} onChange={(value) => useDesignStore.getState().updateFixture(fixture.id, { width: value }, false)} />
        <NumberField label="Depth" value={fixture.depth} min={80} max={1200} onChange={(value) => useDesignStore.getState().updateFixture(fixture.id, { depth: value }, false)} />
        <DeleteButton />
      </div>
    )
  }
  if (selection?.type === 'item') {
    const item = items.find((entry) => entry.id === selection.id)
    const spec = item ? catalogBySku[item.sku] : undefined
    if (!item || !spec) return null
    return (
      <div className="space-y-3">
        <Header kicker={spec.sku} title={spec.name} />
        <Readout label="Price code" value={spec.sku} />
        <NumberField label="Width" value={item.width} min={spec.minW} max={spec.maxW} onChange={(value) => useDesignStore.getState().updateItem(item.id, { width: value }, false)} />
        <NumberField label="Height" value={item.height} min={spec.minH} max={spec.maxH} onChange={(value) => useDesignStore.getState().updateItem(item.id, { height: value }, false)} />
        <NumberField label="Depth" value={item.depth} min={spec.minD} max={spec.maxD} onChange={(value) => useDesignStore.getState().updateItem(item.id, { depth: value }, false)} />
        {(spec.mount === 'wall' || spec.style === 'hood') && (
          <NumberField label="Hanging height" value={item.elevation} min={200} max={2200} onChange={(value) => useDesignStore.getState().updateItem(item.id, { elevation: value }, false)} />
        )}
        {(spec.doorCount === 1 || spec.style === 'corner' || spec.style === 'flap') && (
          <Toggle label="Hinge" value={item.handing === 'left' ? 'Left' : 'Right'} onClick={() => useDesignStore.getState().setHanding(item.id, item.handing === 'left' ? 'right' : 'left')} />
        )}
        {(spec.doorCount > 0 || spec.drawerCount > 0 || spec.style === 'flap' || spec.style === 'dishwasher') && (
          <NumberField label="Opening" value={item.open ?? 0} min={0} max={90} suffix="°" onChange={(value) => useDesignStore.getState().updateItem(item.id, { open: value }, false)} />
        )}
        <WarningList itemId={item.id} />
        <DeleteButton />
      </div>
    )
  }
  const loop = orderedLoop(walls)
  const inner = loop ? offsetLoop(loop.points, loop.walls.map((wall) => wall.thickness / 2)) : null
  const area = inner ? polygonAreaM2(inner) : 0
  return (
    <div className="space-y-3">
      <Header kicker="Room" title={loop ? 'Closed plan' : 'Open plan'} />
      <Readout label="Walls" value={String(walls.length)} />
      <Readout label="Floor area" value={loop ? `${area.toFixed(2)} m²` : '—'} />
      <NumberField label="Ceiling" value={options.ceiling} min={2200} max={3200} onChange={(value) => useDesignStore.getState().patchOptions({ ceiling: value })} />
      <div className="text-[11px] uppercase tracking-wider text-white/45">Roof</div>
      <div className="flex gap-1">
        {(['flat', 'shed', 'gable'] as RoofStyle[]).map((style) => (
          <button key={style} onClick={() => useDesignStore.getState().patchOptions({ roofStyle: style })} className={`flex-1 rounded px-2 py-1.5 text-xs capitalize ${options.roofStyle === style ? 'bg-winner' : 'bg-white/10'}`}>
            {style}
          </button>
        ))}
      </div>
      {options.roofStyle !== 'flat' && (
        <>
          <NumberField label="Knee / eave" value={options.kneeHeight} min={900} max={2600} onChange={(value) => useDesignStore.getState().patchOptions({ kneeHeight: value })} />
          <NumberField label="Ridge" value={options.ridgeHeight} min={1800} max={4500} onChange={(value) => useDesignStore.getState().patchOptions({ ridgeHeight: value })} />
          {options.roofStyle === 'shed' && (
            <label className="block text-[11px] uppercase tracking-wider text-white/45">
              Low wall
              <select
                value={options.roofLowWallId ?? walls[0]?.id ?? ''}
                onChange={(event) => useDesignStore.getState().patchOptions({ roofLowWallId: event.target.value })}
                className="mt-1 w-full rounded border border-white/10 bg-shell-deep px-2 py-1.5 text-sm normal-case tracking-normal text-white"
              >
                {walls.map((wall, index) => (
                  <option key={wall.id} value={wall.id}>
                    Wall {index + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <button
        className="w-full rounded bg-white/10 py-1.5 text-xs"
        onClick={() => {
          const wall = walls[0]
          if (!wall) return
          const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 }
          useDesignStore.getState().addFixture({ id: uid('fixture'), type: 'dormer', x: mid.x, y: mid.y, width: 1100, depth: 800, rotation: 0, wallId: wall.id, height: 1200 })
        }}
      >
        Add dormer
      </button>
      <div className="flex gap-1">
        <button className="flex-1 rounded bg-white/10 py-1.5 text-xs" onClick={() => useDesignStore.getState().setFrontsOpen(78)}>Open fronts</button>
        <button className="flex-1 rounded bg-white/10 py-1.5 text-xs" onClick={() => useDesignStore.getState().setFrontsOpen(0)}>Close fronts</button>
      </div>
      <p className="text-xs leading-relaxed text-white/45">Select a wall, opening, or cabinet. Pillars, pipes, niches, and beams push new units aside.</p>
    </div>
  )
}

function FinishTab() {
  const materials = useDesignStore((state) => state.materials)
  const options = useDesignStore((state) => state.options)
  return (
    <div className="space-y-4">
      <Header kicker="Fronts" title="Door & surface" />
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(DOOR_STYLES) as DoorStyle[]).map((style) => (
          <button
            key={style}
            onClick={() => useDesignStore.getState().patchMaterials({ doorStyle: style, doorColor: DOOR_STYLES[style].color })}
            className={`rounded border px-2 py-2 text-left text-xs ${materials.doorStyle === style ? 'border-winner bg-winner/20' : 'border-white/10'}`}
          >
            <span className="mb-1 block h-5 rounded" style={{ background: DOOR_STYLES[style].color }} />
            {style.replace('-', ' ')}
          </button>
        ))}
      </div>
      <ColorField label="Door colour" value={materials.doorColor} onChange={(value) => useDesignStore.getState().patchMaterials({ doorColor: value })} />
      <NumberField label="Grain angle" value={materials.grainAngle} min={0} max={180} suffix="°" onChange={(value) => useDesignStore.getState().patchMaterials({ grainAngle: value })} />
      <div className="text-[11px] uppercase tracking-wider text-white/45">Worktop</div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(WORKTOPS) as WorktopFinish[]).map((finish) => (
          <button
            key={finish}
            onClick={() =>
              useDesignStore.getState().applySystem({
                kind: 'system',
                sku: finish,
                name: finish,
                category: 'worktop',
                group: 'Worktop',
                summary: '',
                materials: { worktop: finish, worktopColor: WORKTOPS[finish].color },
                options: { autoWorktop: true },
              })
            }
            className={`rounded border px-2 py-2 text-left text-xs capitalize ${materials.worktop === finish ? 'border-winner bg-winner/20' : 'border-white/10'}`}
          >
            <span className="mb-1 block h-5 rounded" style={{ background: WORKTOPS[finish].color }} />
            {WORKTOPS[finish].label}
          </button>
        ))}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-white/45">Handle</div>
      <div className="flex gap-1">
        {(['bar', 'knob', 'gola'] as const).map((handle) => (
          <button
            key={handle}
            onClick={() => useDesignStore.getState().patchMaterials({ handle })}
            className={`flex-1 rounded px-2 py-1.5 text-xs capitalize ${materials.handle === handle ? 'bg-winner' : 'bg-white/10'}`}
          >
            {handle}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {(['auto', 'vertical', 'horizontal-top', 'knob', 'handleless'] as HandlePlacement[]).map((placement) => (
          <button
            key={placement}
            onClick={() => useDesignStore.getState().patchMaterials({ handlePlacement: placement })}
            className={`rounded px-2 py-1.5 text-[11px] capitalize ${materials.handlePlacement === placement ? 'bg-winner' : 'bg-white/10'}`}
          >
            {placement.replace('-', ' ')}
          </button>
        ))}
      </div>
      <ColorField label="Wall paint" value={materials.wallPaint} onChange={(value) => useDesignStore.getState().patchMaterials({ wallPaint: value })} />
      <ColorField label="Floor tile" value={materials.floorTile} onChange={(value) => useDesignStore.getState().patchMaterials({ floorTile: value })} />
      <ColorField label="Grout" value={materials.grout} onChange={(value) => useDesignStore.getState().patchMaterials({ grout: value })} />
      <NumberField label="Tile size" value={materials.tileSize} min={100} max={1200} step={50} onChange={(value) => useDesignStore.getState().patchMaterials({ tileSize: value })} />
      <div className="text-[11px] uppercase tracking-wider text-white/45">Runs</div>
      {([
        ['autoWorktop', 'Worktops'],
        ['autoPlinth', 'Plinths'],
        ['autoCornice', 'Cornice'],
        ['autoPelmet', 'Light pelmet'],
        ['splashback', 'Splashback'],
        ['underLights', 'Under-unit lights'],
        ['ambientOcclusion', 'Ambient occlusion'],
        ['screenReflections', 'Screen reflections'],
      ] as const).map(([key, label]) => (
        <button key={key} className="flex w-full items-center justify-between text-sm" onClick={() => useDesignStore.getState().patchOptions({ [key]: !options[key] })}>
          <span>{label}</span>
          <span className={`rounded px-2 py-0.5 text-[11px] ${options[key] ? 'bg-winner' : 'bg-white/10 text-white/50'}`}>{options[key] ? 'On' : 'Off'}</span>
        </button>
      ))}
      <div className="text-[11px] uppercase tracking-wider text-white/45">Lighting</div>
      <div className="flex gap-1">
        {(['studio', 'daylight', 'evening'] as const).map((preset) => (
          <button
            key={preset}
            onClick={() => useDesignStore.getState().patchOptions({ lighting: preset, ...LIGHT_PRESETS[preset] })}
            className={`flex-1 rounded px-2 py-1.5 text-xs capitalize ${options.lighting === preset ? 'bg-winner' : 'bg-white/10'}`}
          >
            {preset}
          </button>
        ))}
      </div>
      <NumberField label="Sun azimuth" value={options.sunAzimuth} min={0} max={360} suffix="°" onChange={(value) => useDesignStore.getState().patchOptions({ sunAzimuth: value })} />
      <NumberField label="Sun elevation" value={options.sunElevation} min={4} max={80} suffix="°" onChange={(value) => useDesignStore.getState().patchOptions({ sunElevation: value })} />
      <NumberField label="Sun intensity" value={options.sunIntensity} min={0} max={4} step={0.05} suffix="" onChange={(value) => useDesignStore.getState().patchOptions({ sunIntensity: value })} />
      <NumberField label="LED kelvin" value={options.ledKelvin} min={2200} max={6500} step={50} suffix="K" onChange={(value) => useDesignStore.getState().patchOptions({ ledKelvin: value })} />
      <NumberField label="LED intensity" value={options.ledIntensity} min={0} max={4} step={0.05} suffix="" onChange={(value) => useDesignStore.getState().patchOptions({ ledIntensity: value })} />
      <div className="text-[11px] uppercase tracking-wider text-white/45">Still export</div>
      {Object.entries(RENDER_SIZES).map(([key, size]) => (
        <button key={key} className="w-full rounded bg-white/10 py-1.5 text-xs" onClick={() => exportRender(size.width, size.height, `winner-${size.width}.png`)}>
          {size.label}
        </button>
      ))}
    </div>
  )
}

function QuoteTab() {
  const items = useDesignStore((state) => state.items)
  const walls = useDesignStore((state) => state.walls)
  const openings = useDesignStore((state) => state.openings)
  const fixtures = useDesignStore((state) => state.fixtures)
  const materials = useDesignStore((state) => state.materials)
  const options = useDesignStore((state) => state.options)
  const client = useDesignStore((state) => state.client)
  const projectName = useDesignStore((state) => state.projectName)
  const showDimensions = useDesignStore((state) => state.showDimensions)
  const defaultThickness = useDesignStore((state) => state.defaultThickness)
  const catalogRevision = useCatalogStore((state) => state.revision)
  const priceGroups = useCatalogStore((state) => state.groups())
  const groupMult = priceGroups[Math.min(7, Math.max(0, options.priceGroup - 1))] ?? 1
  const quote = useMemo(
    () => buildQuote({ items, walls, openings, materials, options, groupMult, priceOf: (sku, fallback) => useCatalogStore.getState().priceFor(sku, fallback) }),
    [items, walls, openings, materials, options, groupMult, catalogRevision],
  )
  return (
    <div className="space-y-3">
      <Header kicker="Commercial" title={canSeeCost() ? money(quote.gross, options.currency) : 'Costs hidden'} />
      <WarningList />
      <Field label="Client" value={client.name} onChange={(value) => useDesignStore.getState().setClient({ name: value })} />
      <Field label="Address" value={client.address} onChange={(value) => useDesignStore.getState().setClient({ address: value })} />
      <Field label="Reference" value={client.reference} onChange={(value) => useDesignStore.getState().setClient({ reference: value })} />
      <div className="grid grid-cols-2 gap-2 text-[11px] text-white/60">
        <span>{quote.counts.cabinets} cabinets</span>
        <span>{quote.counts.doors} doors</span>
        <span>{quote.counts.endPanels} end panels</span>
        <span>{quote.counts.plinthM.toFixed(2)} m plinth</span>
        <span>{quote.counts.worktopM2.toFixed(2)} m² top</span>
        <span>{quote.counts.corniceM.toFixed(2)} m cornice</span>
        <span>{quote.counts.pelmetM.toFixed(2)} m pelmet</span>
      </div>
      <div className="max-h-64 overflow-auto rounded border border-white/10">
        <table className="w-full text-left text-[11px]">
          <tbody>
            {quote.lines.map((entry) => (
              <tr key={`${entry.sku}-${entry.name}`} className="border-b border-white/5">
                <td className="px-2 py-1 text-white/80">{entry.name}</td>
                <td className="px-2 py-1 text-right tabular">{canSeeCost() ? money(entry.total, options.currency) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Readout label="Fitting" value={money(quote.fitting, options.currency)} />
      <Readout label="Price group" value={`${options.priceGroup} × ${groupMult.toFixed(2)}`} />
      <NumberField label="Price group" value={options.priceGroup} min={1} max={8} suffix="" onChange={(value) => useDesignStore.getState().patchOptions({ priceGroup: value })} />
      <NumberField label="Discount" value={options.discount} min={0} max={40} suffix="%" onChange={(value) => useDesignStore.getState().patchOptions({ discount: value })} />
      <NumberField label="Margin" value={options.margin} min={0} max={40} suffix="%" onChange={(value) => useDesignStore.getState().patchOptions({ margin: value })} />
      <div className="flex gap-1">
        {(['GBP', 'EUR', 'USD'] as CurrencyCode[]).map((currency) => (
          <button key={currency} onClick={() => useDesignStore.getState().patchOptions({ currency })} className={`flex-1 rounded py-1 text-xs ${options.currency === currency ? 'bg-winner' : 'bg-white/10'}`}>
            {currency}
          </button>
        ))}
      </div>
      <NumberField label="VAT %" value={options.vat} min={0} max={25} suffix="%" onChange={(value) => useDesignStore.getState().patchOptions({ vat: value })} />
      <button
        className="flex w-full items-center justify-between text-sm"
        onClick={() => useDesignStore.getState().patchOptions({ fittingEnabled: !options.fittingEnabled })}
      >
        <span>Fitting charges</span>
        <span className={`rounded px-2 py-0.5 text-[11px] ${options.fittingEnabled ? 'bg-winner' : 'bg-white/10'}`}>{options.fittingEnabled ? 'On' : 'Off'}</span>
      </button>
      <button
        className="w-full rounded bg-winner py-2 text-sm font-semibold"
        onClick={() =>
          exportQuotation({
            projectName,
            client,
            quote,
            design: { walls, openings, fixtures, items, materials, options, selection: null, showDimensions, defaultThickness },
          })
        }
      >
        Export PDF quotation
      </button>
      <button
        className="w-full rounded bg-white/10 py-2 text-sm"
        onClick={() => {
          const issues = exportSupplierOrder({ projectName, client, quote, currency: options.currency })
          if (issues.length) window.alert(issues.join('\n'))
        }}
      >
        Confirm and export supplier order
      </button>
      <button
        className="w-full rounded bg-white/10 py-2 text-sm"
        onClick={() =>
          exportInstallerPack({
            projectName,
            quote,
            design: { walls, openings, fixtures, items, materials, options, selection: null, showDimensions, defaultThickness },
          })
        }
      >
        Installer pack PDF
      </button>
    </div>
  )
}

function WarningList({ itemId }: { itemId?: string }) {
  const items = useDesignStore((state) => state.items)
  const walls = useDesignStore((state) => state.walls)
  const fixtures = useDesignStore((state) => state.fixtures)
  const warnings = designWarnings(items, walls, fixtures).filter((warning) => (itemId ? warning.itemId === itemId : true))
  if (!warnings.length) return null
  return (
    <div className="space-y-1 rounded border border-rose-400/40 bg-rose-500/10 p-2 text-xs text-rose-100">
      {warnings.map((warning) => (
        <p key={`${warning.itemId}-${warning.message}`}>{warning.message}</p>
      ))}
    </div>
  )
}

function Header({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">{kicker}</div>
      <div className="text-base font-semibold capitalize text-white">{title}</div>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/50">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[11px] uppercase tracking-wider text-white/45">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded border border-white/10 bg-shell-deep px-2 py-1.5 text-sm normal-case tracking-normal text-white outline-none focus:border-winner" />
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span className="text-white/70">{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-10 cursor-pointer bg-transparent" />
    </label>
  )
}

function Toggle({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-center justify-between text-sm" onClick={onClick}>
      <span className="text-white/70">{label}</span>
      <span className="rounded bg-white/10 px-2 py-1 text-xs">{value}</span>
    </button>
  )
}

function DeleteButton() {
  return (
    <button className="w-full rounded border border-handle/70 py-1.5 text-sm text-handle" onClick={() => useDesignStore.getState().deleteSelection()}>
      Delete
    </button>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = 'mm',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-white/45">
        {label}
        <span className="tabular text-white">
          {Math.round(value)} {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => useDesignStore.getState().beginGesture()}
        onPointerUp={() => useDesignStore.getState().endGesture()}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  )
}

function formatTitle(mm: number) {
  return `${Math.round(mm).toLocaleString('en-GB')} mm`
}
