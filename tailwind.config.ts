import typography from '@tailwindcss/typography'
import type { Config } from 'tailwindcss'
import { colors, fontFamily } from './shared/design-tokens'

export default {
  content: [
    './app/**/*.{vue,ts}'
  ],
  theme: {
    extend: {
      colors: {
        base: colors.base,
        surface: {
          1: colors.surface1,
          2: colors.surface2
        },
        border: {
          DEFAULT: colors.borderDefault,
          strong: colors.borderStrong
        },
        content: {
          primary: colors.contentPrimary,
          secondary: colors.contentSecondary,
          tertiary: colors.contentTertiary
        },
        accent: {
          DEFAULT: colors.accent,
          soft: colors.accentSoft
        },
        success: colors.success,
        danger: colors.danger
      },
      fontFamily,
      boxShadow: {
        float: '0 20px 60px rgba(0,0,0,0.5)'
      },
      height: {
        // 100dvh instead of 100vh: vh is computed against the largest
        // possible viewport and doesn't shrink when the mobile browser's
        // address bar is showing, leaving a gap at the bottom; dvh tracks
        // the actual visible viewport as browser chrome shows/hides.
        app: '100dvh'
      },
      maxHeight: {
        // Caps modal-style panels (e.g. MoveToDialog's folder list) so they
        // never touch the viewport edges, without an arbitrary [80vh] value.
        dialog: '80vh'
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)'
      },
      // NoteReader.vue renders server-sanitized HTML via v-html, so it can't
      // be styled element-by-element with Tailwind classes in the template -
      // @tailwindcss/typography's CSS-variable API is the sanctioned escape
      // hatch, repointed at our design tokens instead of its default palette.
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': colors.contentSecondary,
            '--tw-prose-headings': colors.contentPrimary,
            '--tw-prose-lead': colors.contentSecondary,
            '--tw-prose-links': colors.accent,
            '--tw-prose-bold': colors.contentPrimary,
            '--tw-prose-counters': colors.contentTertiary,
            '--tw-prose-bullets': colors.contentTertiary,
            '--tw-prose-hr': colors.borderDefault,
            '--tw-prose-quotes': colors.contentSecondary,
            '--tw-prose-quote-borders': colors.accentSoft,
            '--tw-prose-captions': colors.contentTertiary,
            '--tw-prose-code': colors.contentPrimary,
            '--tw-prose-th-borders': colors.borderDefault,
            '--tw-prose-td-borders': colors.borderDefault,
            maxWidth: 'none',
            a: { fontWeight: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' },
            'h1, h2, h3, h4': { fontWeight: '600', letterSpacing: '-0.01em' },
            h2: { borderBottom: `1px solid ${colors.borderDefault}`, paddingBottom: '0.5rem' },
            blockquote: {
              fontWeight: '400',
              fontStyle: 'italic',
              borderLeftColor: colors.accentSoft,
              backgroundColor: 'rgba(255,255,255,0.02)',
              padding: '0.5rem 1rem',
              quotes: 'none'
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            code: { fontFamily: fontFamily.mono.join(', '), fontWeight: '400' },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            pre: { backgroundColor: colors.surface2, border: `1px solid ${colors.borderDefault}` },
            'a[data-wikilink-broken]': { textDecorationStyle: 'dashed' }
          }
        }
      }
    }
  },
  plugins: [typography]
} satisfies Config
