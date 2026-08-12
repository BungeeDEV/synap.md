import type { Editor, Range } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import Suggestion from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import SlashCommandMenu from '~/components/SlashCommandMenu.vue'
import type { SlashCommand } from '~/editor/slashCommands'
import { filterSlashCommands } from '~/editor/slashCommands'

interface SlashCommandMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

/**
 * Replaces the old `slashCommandTrigger.ts` (a hand-rolled CM6 line-pattern
 * watcher + `useSlashCommandMenu` useState bridge). `@tiptap/suggestion`
 * owns the trigger-detection, keyboard handling and popup positioning
 * (Floating UI, via `props.mount()`) natively - the Vue side only renders
 * `SlashCommandMenu.vue` into whatever element the plugin hands it.
 */
export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        // Explicit, unique per Suggestion instance - both this and
        // wikilinkExtension.ts's Suggestion() default to the same internal
        // 'suggestion' key otherwise, and ProseMirror throws
        // "Adding different instances of a keyed plugin" the moment both
        // are registered on the same editor.
        pluginKey: new PluginKey('slashCommandSuggestion'),
        char: '/',
        startOfLine: true,
        allowedPrefixes: null,
        items: ({ query }: { query: string }) => filterSlashCommands(query),
        render: () => {
          let component: VueRenderer
          let unmount: (() => void) | undefined

          return {
            onStart: (props: SuggestionProps<SlashCommand, SlashCommand>) => {
              component = new VueRenderer(SlashCommandMenu, {
                props: {
                  items: props.items,
                  query: props.query,
                  onSelect: (command: SlashCommand) => props.command(command)
                },
                editor: props.editor
              })
              unmount = props.mount(component.element as HTMLElement)
            },
            onUpdate: (props: SuggestionProps<SlashCommand, SlashCommand>) => {
              component.updateProps({ items: props.items, query: props.query })
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                unmount?.()
                component.destroy()
                return true
              }
              return (component.ref as SlashCommandMenuRef | null)?.onKeyDown(props) ?? false
            },
            onExit: () => {
              unmount?.()
              component.destroy()
            }
          }
        },
        command: ({ editor, range, props: selected }: { editor: Editor, range: Range, props: SlashCommand }) => {
          editor.chain().focus().deleteRange(range).run()
          selected.run(editor)
        }
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion
      })
    ]
  }
})
