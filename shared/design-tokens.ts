export const colors = {
  base: '#141414',
  surface1: '#1a1a1a',
  surface2: '#232323',
  borderDefault: 'rgba(255,255,255,0.05)',
  borderStrong: 'rgba(255,255,255,0.10)',
  contentPrimary: '#EDEDEC',
  contentSecondary: '#a3a3a3',
  contentTertiary: '#737373',
  accent: '#8B7FE0',
  accentSoft: 'rgba(139,127,224,0.5)',
  success: '#4ADE80',
  danger: '#F87171'
} as const

export const fontFamily = {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
} as const

/** Alpha-blends a `#rrggbb` token to rgba() - used by the CodeMirror heading highlight (graduated accent opacity per level) rather than adding new hue tokens. */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
