export const sceneCapture: {
  grab: null | (() => string | null)
  exportPng: null | ((width: number, height: number, filename: string) => Promise<void>)
} = { grab: null, exportPng: null }
