import { sceneCapture } from './capture'

export const RENDER_SIZES = {
  hd: { width: 1920, height: 1080, label: '1080p PNG' },
  twoK: { width: 2560, height: 1440, label: '2K PNG' },
  fourK: { width: 3840, height: 2160, label: '4K PNG' },
} as const

export async function exportRender(width: number, height: number, filename: string) {
  if (!sceneCapture.exportPng) {
    window.alert('Open the 3D view once so the renderer can capture a still.')
    return
  }
  await sceneCapture.exportPng(width, height, filename)
}
