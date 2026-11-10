/// <reference types="vite/client" />

interface WinnerDesktop {
  onOpenProject: (callback: (text: string) => void) => () => void
}

declare global {
  interface Window {
    winner?: WinnerDesktop
  }
}

export {}
