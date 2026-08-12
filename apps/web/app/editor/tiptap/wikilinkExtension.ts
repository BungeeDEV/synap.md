import type { Editor, Range } from '@tiptap/core'
import { mergeAttributes, Node } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import Suggestion from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import type { MarkdownNodeSpec } from 'tiptap-markdown'
import WikilinkSuggestionList from '~/components/WikilinkSuggestionList.vue'
import type { FileEntry } from '~/utils/fuzzyMatch'
import { flattenFiles, fuzzyMatchFiles } from '~/utils/fuzzyMatch'

export interface WikilinkOptions {
  onNavigate: (path: string) => void
}

interface WikilinkSuggestionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

/**
 * Same title-match resolution `NoteReader.vue`'s server-side render pipeline
 * does via `resolveWikilinkTargetPath` (see decisions.md), just client-side
 * and title-only (no path-suffix fallback) - good enough for "click a link
 * that's already visible in the open vault tree". Duplicate titles resolve
 * to whichever file the tree lists first, same known ambiguity as today.
 */
function resolveWikilinkPath(target: string): string | null {
  const vaultTree = useVaultTreeStore()
  const match = flattenFiles(vaultTree.tree).find((file) => file.title.toLowerCase() === target.toLowerCase())
  return match?.path ?? null
}

const WIKILINK_TEXT_PATTERN = /\[\[([^[\]]+)\]\]/g

function findWikilinkTextMatches(doc: ProseMirrorNode): { from: number, to: number, target: string }[] {
  const matches: { from: number, to: number, target: string }[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (const match of node.text.matchAll(WIKILINK_TEXT_PATTERN)) {
      const from = pos + (match.index ?? 0)
      matches.push({ from, to: from + match[0].length, target: match[1]! })
    }
  })
  return matches
}

/**
 * Converts every literal "[[Title]]" text run in the document into a
 * `wikilink` node - covers content loaded from disk and pasted text, i.e.
 * everything that didn't go through the Suggestion popup below (which
 * inserts the node directly and never produces literal bracket text at
 * all). Matches are applied highest-position-first on a single transaction
 * so earlier (lower-position) matches' coordinates never shift underneath
 * later `replaceWith` calls in the same pass.
 */
function convertWikilinkText(editor: Editor): void {
  const matches = findWikilinkTextMatches(editor.state.doc)
  if (!matches.length) return

  const wikilinkType = editor.schema.nodes.wikilink
  if (!wikilinkType) return

  const tr = editor.state.tr
  for (const { from, to, target } of matches.sort((a, b) => b.from - a.from)) {
    tr.replaceWith(from, to, wikilinkType.create({ target }))
  }
  editor.view.dispatch(tr)
}

export const Wikilink = Node.create<WikilinkOptions>({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { onNavigate: () => {} }
  },

  addAttributes() {
    return {
      target: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-target') ?? element.textContent ?? '',
        renderHTML: (attributes) => ({ 'data-target': attributes.target as string })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-wikilink': '',
      class: 'cursor-pointer rounded-md bg-accent/10 px-1 py-0.5 text-accent transition-colors duration-150 hover:bg-accent/20'
    }), node.attrs.target as string]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          state.write(`[[${node.attrs.target}]]`)
        }
      } satisfies MarkdownNodeSpec
    }
  },

  onCreate() {
    convertWikilinkText(this.editor)
  },

  addProseMirrorPlugins() {
    const options = this.options

    return [
      new Plugin({
        key: new PluginKey('wikilinkBehavior'),
        props: {
          handleClickOn: (_view: EditorView, _pos: number, node: ProseMirrorNode) => {
            if (node.type.name !== 'wikilink') return false
            const path = resolveWikilinkPath(node.attrs.target as string)
            if (path) options.onNavigate(path)
            return true
          }
        },
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr: Transaction) => tr.docChanged)) return null

          const wikilinkType = newState.schema.nodes.wikilink
          if (!wikilinkType) return null

          const matches = findWikilinkTextMatches(newState.doc)
          if (!matches.length) return null

          const tr = newState.tr
          for (const { from, to, target } of matches.sort((a, b) => b.from - a.from)) {
            tr.replaceWith(from, to, wikilinkType.create({ target }))
          }
          return tr
        }
      }),
      Suggestion({
        editor: this.editor,
        // Explicit, unique per Suggestion instance - see slashSuggestion.ts's
        // matching comment. Both default to the same internal 'suggestion'
        // key otherwise, and ProseMirror throws "Adding different instances
        // of a keyed plugin" the moment both are registered on one editor.
        pluginKey: new PluginKey('wikilinkSuggestion'),
        char: '[[',
        allowedPrefixes: null,
        items: ({ query }: { query: string }) => fuzzyMatchFiles(query, flattenFiles(useVaultTreeStore().tree), 8),
        render: () => {
          let component: VueRenderer
          let unmount: (() => void) | undefined

          return {
            onStart: (props: SuggestionProps<FileEntry, FileEntry>) => {
              component = new VueRenderer(WikilinkSuggestionList, {
                props: {
                  items: props.items,
                  onSelect: (file: FileEntry) => props.command(file)
                },
                editor: props.editor
              })
              unmount = props.mount(component.element as HTMLElement)
            },
            onUpdate: (props: SuggestionProps<FileEntry, FileEntry>) => {
              component.updateProps({ items: props.items })
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                unmount?.()
                component.destroy()
                return true
              }
              return (component.ref as WikilinkSuggestionListRef | null)?.onKeyDown(props) ?? false
            },
            onExit: () => {
              unmount?.()
              component.destroy()
            }
          }
        },
        command: ({ editor, range, props: file }: { editor: Editor, range: Range, props: FileEntry }) => {
          editor.chain().focus().insertContentAt(range, { type: 'wikilink', attrs: { target: file.title } }).run()
        }
      })
    ]
  }
})
