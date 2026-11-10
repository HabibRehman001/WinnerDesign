import * as BABYLON from 'babylonjs'
import type { Finish, MaterialBank } from './materials'

export interface BuildContext {
  scene: BABYLON.Scene
  bank: MaterialBank
  shadows: BABYLON.ShadowGenerator | null
}

type Vec = [number, number, number]

export function node(ctx: BuildContext, name: string, parent: BABYLON.Node | null, position: Vec = [0, 0, 0], rotation: Vec = [0, 0, 0]) {
  const transform = new BABYLON.TransformNode(name, ctx.scene)
  transform.parent = parent
  transform.position.set(...position)
  transform.rotation.set(...rotation)
  return transform
}

export function finishMesh(ctx: BuildContext, mesh: BABYLON.Mesh, finish: Finish, parent: BABYLON.Node | null, cast = true) {
  mesh.material = ctx.bank.get(finish)
  mesh.parent = parent
  mesh.receiveShadows = true
  if (cast && ctx.shadows && (finish.alpha ?? 1) >= 1) ctx.shadows.addShadowCaster(mesh, false)
  return mesh
}

export function box(ctx: BuildContext, size: Vec, finish: Finish, parent: BABYLON.Node | null, position: Vec = [0, 0, 0], rotation: Vec = [0, 0, 0], cast = true) {
  const mesh = BABYLON.MeshBuilder.CreateBox('box', { width: Math.max(0.001, size[0]), height: Math.max(0.001, size[1]), depth: Math.max(0.001, size[2]) }, ctx.scene)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  return finishMesh(ctx, mesh, finish, parent, cast)
}

export function cylinder(ctx: BuildContext, top: number, bottom: number, height: number, finish: Finish, parent: BABYLON.Node | null, position: Vec = [0, 0, 0], arc = 1) {
  const mesh = BABYLON.MeshBuilder.CreateCylinder('cyl', { diameterTop: top * 2, diameterBottom: bottom * 2, height, tessellation: 20, arc }, ctx.scene)
  mesh.position.set(...position)
  return finishMesh(ctx, mesh, finish, parent)
}

export function sphere(ctx: BuildContext, radius: number, finish: Finish, parent: BABYLON.Node | null, position: Vec = [0, 0, 0]) {
  const mesh = BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: radius * 2, segments: 12 }, ctx.scene)
  mesh.position.set(...position)
  return finishMesh(ctx, mesh, finish, parent)
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
