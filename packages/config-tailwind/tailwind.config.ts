import typography from '@tailwindcss/typography'
import type { Config } from 'tailwindcss'
import { colors, fontFamily } from '@synap/design-tokens'

export default {
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
          soft: colors.accentSoft,
          strong: colors.accentStrong
        },
        success: {
          DEFAULT: colors.success,
          strong: colors.successStrong
        },
        danger: {
          DEFAULT: colors.danger,
          strong: colors.dangerStrong
        }
      },
      fontFamily,
      boxShadow: {
        float: '0 20px 60px rgba(0,0,0,0.5)'
      },
      maxWidth: {
        // NoteEditor.vue's reading/writing column - named token instead of
        // an arbitrary `max-w-[750px]` per STYLEGUIDE.md's "config first"
        // rule. Distinct from the existing `max-w-3xl` (768px, NoteReader's
        // width) - the full-page-canvas editor rewrite asked for exactly
        // 750px, close but deliberately not unified with the reader's value.
        editor: '750px'
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
      gridTemplateRows: {
        // Jank-free height transition for VaultTree's folder expand/collapse:
        // the row wrapper transitions grid-template-rows between these two
        // (grid-rows-collapsed/-expanded classes) instead of animating
        // `height: auto`, which CSS can't do natively. Named tokens instead
        // of grid-rows-[0fr]/[1fr] arbitrary values per STYLEGUIDE.md.
        collapsed: '0fr',
        expanded: '1fr'
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
            // Deliberately more generous than the plugin's own defaults -
            // large top gaps before h2/h3 (they start a new section) and a
            // tight gap after (they belong with what follows), Notion/
            // Outline-style. em-based (not fixed rem) so the rhythm scales
            // correctly whether an element uses `prose` or `prose-sm`.
            h1: { fontWeight: '700', marginTop: '0', marginBottom: '1.2em' },
            h2: {
              marginTop: '2em',
              marginBottom: '0.5em',
              borderBottom: `1px solid ${colors.borderDefault}`,
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
              borderLeftColor: colors.accentSoft,
              backgroundColor: 'rgba(255,255,255,0.02)',
              padding: '0.5rem 1rem',
              quotes: 'none'
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            // Rounded, softly-tinted box instead of bare mono text - same
            // visual weight as the "Inline-Code / Shortcut-Badge" recipe in
            // STYLEGUIDE.md (bg-white/[0.06] rounded px-1.5 py-0.5), just
            // expressed as raw CSS since @tailwindcss/typography's
            // CSS-variable API doesn't take Tailwind classes. Excluded from
            // `pre code` (fenced blocks already get their own background via
            // the `pre` rule below and shouldn't double up).
            code: { fontFamily: fontFamily.mono.join(', '), fontWeight: '400' },
            ':not(pre) > code': {
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '0.375rem',
              padding: '0.15em 0.4em'
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            pre: { backgroundColor: colors.surface2, border: `1px solid ${colors.borderDefault}` },
            'a[data-wikilink-broken]': { textDecorationStyle: 'dashed' },
            // Tiptap's TaskList/TaskItem DOM (`<ul data-type="taskList"><li
            // data-type="taskItem"><label><input type=checkbox>...`) isn't a
            // plain <ul><li> list, so it needs its own layout - the native
            // checkbox's own `accent-color` (accentColor below) replaces the
            // read-only reader's own checkbox styling recipe, since there's
            // no clean way to fake the "filled + white check icon" look on a
            // real <input> without a background-image data URI.
            'ul[data-type="taskList"]': { listStyle: 'none', margin: '0', padding: '0' },
            'ul[data-type="taskList"] li': { display: 'flex', alignItems: 'flex-start', gap: '0.5rem' },
            'ul[data-type="taskList"] li > label': { marginTop: '0.35em', userSelect: 'none' },
            'ul[data-type="taskList"] li > div': { flex: '1 1 auto' },
            'ul[data-type="taskList"] li > div > p': { margin: '0' },
            'ul[data-type="taskList"] input[type="checkbox"]': {
              width: '1rem',
              height: '1rem',
              borderRadius: '0.25rem',
              accentColor: colors.accent
            }
          }
        }
      }
    }
  },
  plugins: [typography]
} satisfies Config
