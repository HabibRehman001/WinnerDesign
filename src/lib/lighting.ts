import type { LightingPreset, Pt } from '../types'

export const LIGHT_PRESETS: Record<LightingPreset, { sunAzimuth: number; sunElevation: number; sunIntensity: number; ledKelvin: number; ledIntensity: number }> = {
  studio: { sunAzimuth: 40, sunElevation: 64, sunIntensity: 1.35, ledKelvin: 4000, ledIntensity: 0.55 },
  daylight: { sunAzimuth: 270, sunElevation: 48, sunIntensity: 2.2, ledKelvin: 3500, ledIntensity: 1.1 },
  evening: { sunAzimuth: 250, sunElevation: 12, sunIntensity: 0.5, ledKelvin: 2700, ledIntensity: 2.6 },
}

export function kelvinToHex(kelvin: number) {
  const temp = Math.max(1000, Math.min(12000, kelvin)) / 100
  let red: number
  let green: number
  let blue: number
  if (temp <= 66) {
    red = 255
    green = 99.4708025861 * Math.log(temp) - 161.1195681661
  } else {
    red = 329.698727446 * (temp - 60) ** -0.1332047592
    green = 288.1221695283 * (temp - 60) ** -0.0755148492
  }
  if (temp >= 66) blue = 255
  else if (temp <= 19) blue = 0
  else blue = 138.5177312231 * Math.log(temp - 10) - 305.0447927307
  const channel = (value: number) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`
}

export function sunVector(center: Pt, azimuth: number, elevation: number, distance = 14): [number, number, number] {
  const az = (azimuth * Math.PI) / 180
  const el = (elevation * Math.PI) / 180
  const horizontal = Math.cos(el) * distance
  return [center.x / 1000 + Math.sin(az) * horizontal, Math.sin(el) * distance, center.y / 1000 + Math.cos(az) * horizontal]
}
