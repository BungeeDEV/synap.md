export const themeIds = ['dark', 'light'] as const
export type ThemeId = typeof themeIds[number]

export const themes = {
  dark: {
    base: '#141414',
    surface1: '#1a1a1a',
    surface2: '#232323',
    borderDefault: 'rgba(255,255,255,0.05)',
    borderStrong: 'rgba(255,255,255,0.10)',
    contentPrimary: '#EDEDEC',
    contentSecondary: '#a3a3a3',
    contentTertiary: '#737373',
    accent: '#F5A623',
    accentSoft: 'rgba(245, 166, 35, 0.5)',
    success: '#4ADE80',
    danger: '#F87171',
    accentStrong: '#D97706',
    successStrong: '#15803D',
    dangerStrong: '#DC2626',
    overlay1: 'rgba(255,255,255,0.02)', // for blockquote
    overlay2: 'rgba(255,255,255,0.06)', // for inline code
  },
  light: {
    base: '#ffffff',
    surface1: '#f4f4f5',
    surface2: '#e4e4e7',
    borderDefault: 'rgba(0,0,0,0.05)',
    borderStrong: 'rgba(0,0,0,0.10)',
    contentPrimary: '#18181b',
    contentSecondary: '#52525b',
    contentTertiary: '#a1a1aa',
    accent: '#F5A623',
    accentSoft: 'rgba(245, 166, 35, 0.2)',
    success: '#16a34a',
    danger: '#dc2626',
    accentStrong: '#b45309',
    successStrong: '#15803d',
    dangerStrong: '#991b1b',
    overlay1: 'rgba(0,0,0,0.03)',
    overlay2: 'rgba(0,0,0,0.06)',
  }
} as const

// Helper to convert hex to RGB values for custom accent colors
export function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? [
    parseInt(result[1]!, 16),
    parseInt(result[2]!, 16),
    parseInt(result[3]!, 16)
  ] : null
}

export function computeAccentVariations(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb
  // Soft is just transparent version
  const soft = `rgba(${r}, ${g}, ${b}, 0.5)`
  // Strong: we can just darken it slightly. A simple approach is multiplying by 0.8
  const strong = `rgba(${Math.round(r * 0.8)}, ${Math.round(g * 0.8)}, ${Math.round(b * 0.8)}, 1)`
  return { soft, strong }
}

export const fontFamily = {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
} as const
