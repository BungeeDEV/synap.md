import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { autocompletion } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { colors } from '#shared/design-tokens'
import { flattenFiles, fuzzyMatchFiles } from '~/utils/fuzzyMatch'

/**
 * Completion source for `[[...` wikilink typing. Reuses the same
 * flatten-then-fuzzy-match approach CommandPalette.vue already uses -
 * recomputed on every keystroke rather than cached, since the vault tree is
 * small enough that this is cheap.
 */
function wikilinkCompletionSource(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(/\[\[([^\]]*)$/)
  if (!match) return null

  const query = match.text.slice(2)
  const vaultTree = useVaultTreeStore()
  const files = flattenFiles(vaultTree.tree)
  const matches = fuzzyMatchFiles(query, files, 8)

  const titleCounts = new Map<string, number>()
  for (const file of files) {
    titleCounts.set(file.title, (titleCounts.get(file.title) ?? 0) + 1)
  }

  return {
    from: match.from + 2,
    options: matches.map((file) => ({
      label: file.title,
      detail: (titleCounts.get(file.title) ?? 0) > 1 ? file.path : undefined,
      apply: (view, _completion, from, to) => {
        const alreadyClosed = view.state.sliceDoc(to, to + 2) === ']]'
        const insert = alreadyClosed ? file.title : `${file.title}]]`
        view.dispatch({
          changes: { from, to, insert },
          // Cursor always lands right after the title, before the closing
          // "]]" - whether that "]]" was just inserted or was already there
          // (e.g. from smartEditing's auto-pair, or the cursor sitting
          // between existing brackets).
          selection: { anchor: from + file.title.length }
        })
      }
    })),
    validFor: /^[^\]]*$/
  }
}

/**
 * CM6 extension: `[[`-triggered wikilink autocomplete, styled via the shared
 * design tokens (the established CodeMirror exception to the Tailwind-only
 * rule - CM6's tooltip DOM isn't reachable with Tailwind classes).
 */
export function wikilinkAutocomplete(): Extension {
  return [
    autocompletion({ override: [wikilinkCompletionSource] }),
    EditorView.theme({
      '.cm-tooltip-autocomplete': {
        backgroundColor: colors.surface1,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: '0.75rem',
        overflow: 'hidden'
      },
      '.cm-tooltip-autocomplete ul': {
        fontFamily: 'inherit'
      },
      '.cm-tooltip-autocomplete ul li': {
        padding: '0.375rem 0.75rem'
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: colors.surface2,
        color: colors.contentPrimary
      },
      '.cm-completionLabel': { color: colors.contentPrimary },
      '.cm-completionDetail': { color: colors.contentTertiary, fontStyle: 'normal', marginLeft: '0.5rem' }
    }, { dark: true })
  ]
}
