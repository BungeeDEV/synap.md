import typography from '@tailwindcss/typography'
import type { Config } from 'tailwindcss'
import { fontFamily } from '@synap/design-tokens'

export default {
  theme: {
    extend: {
      colors: {
        base: 'var(--color-base)',
        surface: {
          1: 'var(--color-surface-1)',
          2: 'var(--color-surface-2)'
        },
        border: {
          DEFAULT: 'var(--color-border-default)',
          strong: 'var(--color-border-strong)'
        },
        content: {
          primary: 'var(--color-content-primary)',
          secondary: 'var(--color-content-secondary)',
          tertiary: 'var(--color-content-tertiary)'
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          soft: 'var(--color-accent-soft)',
          strong: 'var(--color-accent-strong)'
        },
        success: {
          DEFAULT: 'var(--color-success)',
          strong: 'var(--color-success-strong)'
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          strong: 'var(--color-danger-strong)'
        }
      },
      fontFamily,
      boxShadow: {
        float: '0 20px 60px rgba(0,0,0,0.5)'
      },
      maxWidth: {
        editor: '750px'
      },
      height: {
        app: '100dvh'
      },
      maxHeight: {
        dialog: '80vh'
      },
      gridTemplateRows: {
        collapsed: '0fr',
        expanded: '1fr'
      },
      keyframes: {
        'indeterminate-progress': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' }
        }
      },
      animation: {
        'indeterminate-progress': 'indeterminate-progress 1.1s ease-in-out infinite'
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)'
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--color-content-secondary)',
            '--tw-prose-headings': 'var(--color-content-primary)',
            '--tw-prose-lead': 'var(--color-content-secondary)',
            '--tw-prose-links': 'var(--color-accent)',
            '--tw-prose-bold': 'var(--color-content-primary)',
            '--tw-prose-counters': 'var(--color-content-tertiary)',
            '--tw-prose-bullets': 'var(--color-content-tertiary)',
            '--tw-prose-hr': 'var(--color-border-default)',
            '--tw-prose-quotes': 'var(--color-content-secondary)',
            '--tw-prose-quote-borders': 'var(--color-accent-soft)',
            '--tw-prose-captions': 'var(--color-content-tertiary)',
            '--tw-prose-code': 'var(--color-content-primary)',
            '--tw-prose-th-borders': 'var(--color-border-default)',
            '--tw-prose-td-borders': 'var(--color-border-default)',
            maxWidth: 'none',
            a: { fontWeight: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' },
            'h1, h2, h3, h4': { fontWeight: '600', letterSpacing: '-0.01em' },
            h1: { fontWeight: '700', marginTop: '0', marginBottom: '1.2em' },
            h2: {
              marginTop: '2em',
              marginBottom: '0.5em',
              borderBottom: `1px solid var(--color-border-default)`,
              paddingBottom: '0.5rem'
            },
            h3: { marginTop: '1.75em', marginBottom: '0.5em' },
            p: { lineHeight: '1.7' },
            'ul, ol': { paddingLeft: '1.5em', marginTop: '1.25em', marginBottom: '1.25em' },
            li: { marginTop: '0.35em', marginBottom: '0.35em' },
            'li > p': { marginTop: '0.35em', marginBottom: '0.35em' },
            blockquote: {
              fontWeight: '400',
              fontStyle: 'italic',
              borderLeftColor: 'var(--color-accent-soft)',
              backgroundColor: 'var(--color-overlay-1)',
              padding: '0.5rem 1rem',
              quotes: 'none'
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            code: { fontFamily: fontFamily.mono.join(', '), fontWeight: '400' },
            ':not(pre) > code': {
              backgroundColor: 'var(--color-overlay-2)',
              borderRadius: '0.375rem',
              padding: '0.15em 0.4em'
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            pre: { backgroundColor: 'var(--color-surface-2)', border: `1px solid var(--color-border-default)` },
            'a[data-wikilink-broken]': { textDecorationStyle: 'dashed' },
            'ul[data-type="taskList"]': { listStyle: 'none', margin: '0', padding: '0' },
            'ul[data-type="taskList"] li': { display: 'flex', alignItems: 'flex-start', gap: '0.5rem' },
            'ul[data-type="taskList"] li > label': { marginTop: '0.35em', userSelect: 'none' },
            'ul[data-type="taskList"] li > div': { flex: '1 1 auto' },
            'ul[data-type="taskList"] li > div > p': { margin: '0' },
            'ul[data-type="taskList"] input[type="checkbox"]': {
              width: '1rem',
              height: '1rem',
              borderRadius: '0.25rem',
              accentColor: 'var(--color-accent)'
            }
          }
        }
      }
    }
  },
  plugins: [typography]
} satisfies Config
