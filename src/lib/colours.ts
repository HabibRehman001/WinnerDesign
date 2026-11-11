export interface NamedColour {
  code: string
  name: string
  hex: string
}

/** A short kitchen set of RAL Classic colours, not the full RAL book. */
export const RAL_CLASSIC: NamedColour[] = [
  { code: 'RAL 9010', name: 'Pure white', hex: '#F1ECE1' },
  { code: 'RAL 9016', name: 'Traffic white', hex: '#F1F0EA' },
  { code: 'RAL 9003', name: 'Signal white', hex: '#F4F4F4' },
  { code: 'RAL 1013', name: 'Oyster white', hex: '#E3D9C6' },
  { code: 'RAL 1015', name: 'Light ivory', hex: '#E6D2B5' },
  { code: 'RAL 7035', name: 'Light grey', hex: '#D7D7D7' },
  { code: 'RAL 7016', name: 'Anthracite grey', hex: '#293133' },
  { code: 'RAL 7022', name: 'Umbra grey', hex: '#4C4A44' },
  { code: 'RAL 3003', name: 'Ruby red', hex: '#861A22' },
  { code: 'RAL 5003', name: 'Sapphire blue', hex: '#1D334A' },
  { code: 'RAL 6005', name: 'Moss green', hex: '#114232' },
  { code: 'RAL 8017', name: 'Chocolate brown', hex: '#44322D' },
]

const HUE_ANGLE: Record<string, number> = { Y: 60, R: 0, B: 240, G: 120 }
const NEXT_HUE: Record<string, string> = { Y: 'R', R: 'B', B: 'G', G: 'Y' }

function signedTurn(from: number, to: number) {
  let turn = to - from
  if (turn > 180) turn -= 360
  if (turn < -180) turn += 360
  return turn
}

function hslToHex(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) [r, g, b] = [c, x, 0]
  else if (hue < 120) [r, g, b] = [x, c, 0]
  else if (hue < 180) [r, g, b] = [0, c, x]
  else if (hue < 240) [r, g, b] = [0, x, c]
  else if (hue < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const byte = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')
  return `#${byte(r)}${byte(g)}${byte(b)}`.toUpperCase()
}

/** Approximate NCS S bbcc-hue, for example "NCS S 0500-N" or "NCS S 2030-Y30R". */
export function ncsToHex(code: string): string | null {
  const compact = code.trim().toUpperCase().replace(/\s+/g, '')
  const neutral = compact.match(/^NCSS?(\d{2})(\d{2})-N$/)
  const chromatic = compact.match(/^NCSS?(\d{2})(\d{2})-([YRGB])(\d{2})([YRGB])$/)
  const pure = compact.match(/^NCSS?(\d{2})(\d{2})-([YRGB])$/)
  const match = neutral ?? chromatic ?? pure
  if (!match) return null
  const blackness = Number(match[1])
  const chroma = Number(match[2])
  if (blackness + chroma > 100) return null
  const lightness = (100 - blackness) / 100 * (1 - chroma / 220)
  if (neutral) return hslToHex(0, 0, (100 - blackness) / 100)
  const start = match[3]
  const percent = chromatic ? Number(match[4]) : 0
  const end = chromatic ? match[5] : start
  if (chromatic && NEXT_HUE[start] !== end) return null
  if (percent % 10 !== 0 || percent > 90) return null
  const angle = HUE_ANGLE[start] + signedTurn(HUE_ANGLE[start], HUE_ANGLE[end]) * (percent / 100)
  const saturation = Math.min(1, chroma / Math.max(12, 100 - blackness))
  return hslToHex(angle, saturation, Math.min(0.96, Math.max(0.04, lightness)))
}
