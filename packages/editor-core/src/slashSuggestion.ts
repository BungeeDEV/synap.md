import type { Editor, Range } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import type { SuggestionOptions } from '@tiptap/suggestion'
import Suggestion from '@tiptap/suggestion'
import type { SlashCommand, SlashCommandOptions } from './slashCommands'
import { getSlashCommands, filterSlashCommands } from './slashCommands'

export interface SlashCommandExtensionOptions {
  suggestion: Omit<SuggestionOptions<SlashCommand>, 'editor'>
  slashCommandOptions: SlashCommandOptions
}

/**
 * Replaces the old `slashCommandTrigger.ts` (a hand-rolled CM6 line-pattern
 * watcher + `useSlashCommandMenu` useState bridge). `@tiptap/suggestion`
 * owns the trigger-detection, keyboard handling and popup positioning
 * (Floating UI, via `props.mount()`) natively - the Vue side only renders
 * `SlashCommandMenu.vue` into whatever element the plugin hands it.
 */
export const SlashCommandExtension = Extension.create<SlashCommandExtensionOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      slashCommandOptions: {
        onAttachmentInsert: () => {}
      },
      suggestion: {
        // Explicit, unique per Suggestion instance - both this and
        // wikilinkExtension.ts's Suggestion() default to the same internal
        // 'suggestion' key otherwise, and ProseMirror throws
        // "Adding different instances of a keyed plugin" the moment both
        // are registered on the same editor.
        pluginKey: new PluginKey('slashCommandSuggestion'),
        char: '/',
        startOfLine: true,
      } as Omit<SuggestionOptions<SlashCommand>, 'editor'>
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        items: ({ query }) => filterSlashCommands(query, getSlashCommands(this.options.slashCommandOptions)),
        command: ({ editor, range, props: selected }) => {
          editor.chain().focus().deleteRange(range).run()
          selected.run(editor)
        },
        ...this.options.suggestion
      })
    ]
  }
})
