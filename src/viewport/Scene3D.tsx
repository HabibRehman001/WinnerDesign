import { useEffect, useRef } from 'react'
import { useCatalogStore } from '../store/useCatalogStore'
import { useDesignStore } from '../store/useDesignStore'
import { DesignViewport } from './babylon/viewport'

export function Scene3D({ mode }: { mode: 'orbit' | 'walk' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<DesignViewport | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const view = new DesignViewport(canvas)
    viewRef.current = view
    const stopDesign = useDesignStore.subscribe(() => view.sync())
    const stopCatalog = useCatalogStore.subscribe(() => view.sync())
    const observer = new ResizeObserver(() => view.resize())
    observer.observe(canvas)
    return () => {
      stopDesign()
      stopCatalog()
      observer.disconnect()
      view.dispose()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    viewRef.current?.setMode(mode)
  }, [mode])

  return <canvas ref={canvasRef} className="h-full w-full touch-none" />
}
