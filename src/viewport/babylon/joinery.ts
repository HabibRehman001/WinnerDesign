import * as BABYLON from 'babylonjs'
import earcut from 'earcut'
import { WORKTOPS } from '../../catalog'
import { buildPlates } from '../../lib/joinery'
import { buildRuns, runPose } from '../../lib/runs'
import { wallLength } from '../../lib/geometry'
import type { DesignOptions, Materials, PlacedItem, Pt, Wall } from '../../types'
import type { Finish } from './materials'
import { box, finishMesh, node, type BuildContext } from './parts'

export interface JoineryInput {
  items: PlacedItem[]
  walls: Wall[]
  options: DesignOptions
  materials: Materials
}

const toShape = (ring: Pt[]) => ring.map((point) => new BABYLON.Vector3(point.x / 1000, 0, point.y / 1000))

/** Extrudes a plan-space ring so its top face sits at `top` metres. */
function plate(ctx: BuildContext, parent: BABYLON.Node, ring: Pt[], holes: Pt[][], top: number, thickness: number, finish: Finish) {
  if (ring.length < 3) return null
  const mesh = BABYLON.MeshBuilder.ExtrudePolygon('plate', { shape: toShape(ring), holes: holes.map(toShape), depth: Math.max(0.004, thickness) }, ctx.scene, earcut)
  mesh.position.y = top
  finishMesh(ctx, mesh, finish, parent)
  return mesh
}

function ringLength(ring: Pt[]) {
  let length = 0
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index]
    const b = ring[(index + 1) % ring.length]
    length += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return length / 2000
}

function band(ctx: BuildContext, parent: BABYLON.Node, a: Pt, b: Pt, y: number, thickness: number, finish: Finish) {
  const length = Math.hypot(b.x - a.x, b.y - a.y) / 1000
  if (length < 0.02) return
  box(ctx, [length, thickness, 0.01], finish, parent, [(a.x + b.x) / 2000, y, (a.y + b.y) / 2000], [0, Math.atan2(-(b.y - a.y), b.x - a.x), 0])
}

export function worktopFinish(materials: Materials): Finish {
  const preset = WORKTOPS[materials.worktop]
  const pattern = materials.worktop === 'wood' ? 'wood' : materials.worktop === 'marble' || materials.worktop === 'granite' ? 'stone' : undefined
  return {
    color: materials.worktopColor,
    roughness: preset.roughness,
    metallic: preset.metalness,
    clearCoat: materials.worktop === 'steel' ? 0.4 : 0.08,
    pattern,
    grain: materials.grainAngle,
    repeat: pattern ? 1.5 : undefined,
  }
}

export function buildJoinery(ctx: BuildContext, input: JoineryInput) {
  const { items, walls, options, materials } = input
  const root = node(ctx, 'joinery', null)
  const baseRuns = buildRuns(items, walls, 'base')
  const wallRuns = buildRuns(items, walls, 'wall')
  const topThick = options.worktopThickness / 1000
  const edge: Finish = { color: '#1A1D20', roughness: 0.45 }
  const fronts: Finish = { color: materials.doorColor, roughness: 0.42 }

  if (options.autoWorktop) {
    for (const entry of buildPlates(baseRuns, walls, items, { extra: 20, cutouts: true })) {
      plate(ctx, root, entry.ring, entry.holes, (entry.runHeight + options.worktopThickness) / 1000, topThick, worktopFinish(materials))
      for (const line of entry.bands) band(ctx, root, line.a, line.b, (entry.runHeight + options.worktopThickness / 2) / 1000, topThick * 0.92, edge)
    }
  }
  if (options.autoPlinth) {
    for (const entry of buildPlates(baseRuns, walls, items, { extra: -50 })) {
      plate(ctx, root, entry.ring, [], options.plinthHeight / 1000, options.plinthHeight / 1000, { color: '#2C3036', roughness: 0.72, metallic: 0.04 })
    }
  }
  if (options.splashback) {
    for (const entry of buildPlates(baseRuns, walls, items, { depthOf: () => 16 })) {
      const top = (entry.runHeight + options.worktopThickness + options.splashHeight) / 1000
      const mesh = plate(ctx, root, entry.ring, [], top, options.splashHeight / 1000, { color: materials.splashTile, roughness: 0.55 })
      if (!mesh) continue
      mesh.material = ctx.bank.tiles(
        materials.splashTile,
        materials.splashGrout,
        materials.splashTileSize,
        Math.max(0.2, ringLength(entry.ring)),
        options.splashHeight / 1000,
        materials.splashTileAngle,
      )
    }
  }
  if (options.autoCornice) {
    for (const entry of buildPlates(wallRuns, walls, items, { extra: 18 })) {
      plate(ctx, root, entry.ring, [], (entry.runElevation + entry.runHeight + 45) / 1000, 0.045, fronts)
    }
  }
  if (options.autoPelmet) {
    for (const entry of buildPlates(wallRuns, walls, items, { depthOf: () => 42, insetOf: (run) => Math.max(0, run.depth - 42) })) {
      plate(ctx, root, entry.ring, [], entry.runElevation / 1000, 0.04, { ...fronts, roughness: 0.4 })
      if (options.underLights) {
        for (const line of entry.bands) band(ctx, root, line.a, line.b, entry.runElevation / 1000 - 0.052, 0.012, edge)
      }
    }
  }
  buildFillers(ctx, root, baseRuns, walls, options, fronts)
  buildFillers(ctx, root, wallRuns, walls, options, fronts)
  return root
}

function buildFillers(ctx: BuildContext, root: BABYLON.Node, runs: ReturnType<typeof buildRuns>, walls: Wall[], options: DesignOptions, finish: Finish) {
  for (const run of runs) {
    const wall = walls.find((entry) => entry.id === run.wallId)
    if (!wall) continue
    const len = wallLength(wall)
    const gaps = [
      run.t0 >= 15 && run.t0 <= 150 ? { t0: 0, t1: run.t0 } : null,
      len - run.t1 >= 15 && len - run.t1 <= 150 ? { t0: run.t1, t1: len } : null,
    ]
    for (const gap of gaps) {
      if (!gap) continue
      const pose = runPose({ ...run, t0: gap.t0, t1: gap.t1 }, wall, walls, run.kind === 'base' ? run.depth : run.depth, 0)
      const height = run.kind === 'base' ? (run.height - (options.autoPlinth ? options.plinthHeight : 0)) / 1000 : run.height / 1000
      const y = run.kind === 'base' ? (options.autoPlinth ? options.plinthHeight : 0) / 1000 + height / 2 : run.elevation / 1000 + height / 2
      const width = Math.max(0.015, (gap.t1 - gap.t0) / 1000)
      box(ctx, [width, height, 0.018], finish, root, [pose.center.x / 1000, y, pose.center.y / 1000], [0, -pose.rotation, 0])
    }
  }
}
