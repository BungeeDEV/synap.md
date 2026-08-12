export const colors = {
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
  // Darker/more saturated variants of accent/success/danger, for solid-fill
  // UI elements that need a white icon/text on top (e.g. VaultTree.vue's
  // swipe-action buttons) - the base tones above are calibrated as
  // foreground accents on dark surfaces (text-accent/text-success/
  // text-danger), not as background fills, and white-on-base contrast is
  // only ~1.4-1.9:1. Each *Strong tone keeps the same hue and was picked to
  // clear ~4.5:1 against white (accentStrong ~7:1, successStrong ~5:1,
  // dangerStrong ~4.8:1).
  accentStrong: '#D97706',
  successStrong: '#15803D',
  dangerStrong: '#DC2626'
} as const

export const fontFamily = {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
} as const

/**
 * Heading font-size ratios, shared by the CodeMirror Magic View highlight
 * style (NoteEditor.vue) and derived from `@tailwindcss/typography`'s
 * `prose-sm` scale (the read-only Preview's actual rendering, see
 * tailwind.config.ts's `typography.css` block) - 30/20/18px over its 14px
 * base. h4 has no size override in that scale either (bold + tight tracking
 * only, same as body size) - Magic View mirrors that rather than inventing a
 * 4th step, so both views stay pixel-equivalent instead of drifting apart.
 */
export const headingFontSize = {
  h1: '2.143em',
  h2: '1.429em',
  h3: '1.286em'
} as const
