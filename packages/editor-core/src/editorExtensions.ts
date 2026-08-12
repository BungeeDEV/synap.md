import type { AnyExtension } from '@tiptap/core'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import type { MarkdownStorage } from 'tiptap-markdown'
import { Markdown } from 'tiptap-markdown'
import { ResolvedImage } from './resolvedImage'
import { SlashCommandExtension } from './slashSuggestion'
import { UploadPlaceholder } from './uploadPlaceholder'
import { Wikilink } from './wikilinkExtension'

// tiptap-markdown's own types don't merge `editor.storage.markdown` into
// core's Storage interface - added here once, centrally, rather than an
// `as any` cast at every `editor.storage.markdown`/`.commands.setContent()`
// call site.
declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage
  }
}

import type { SuggestionOptions } from '@tiptap/suggestion'
import type { SlashCommand, SlashCommandOptions } from './slashCommands'
import type { FileEntry } from './fuzzyMatch'

export interface EditorExtensionsOptions {
  onWikilinkNavigate: (path: string) => void
  slashCommandOptions: SlashCommandOptions
  slashSuggestion?: Omit<SuggestionOptions<SlashCommand>, 'editor'>
  wikilinkSuggestion?: Omit<SuggestionOptions<FileEntry>, 'editor'>
}

/**
 * Central extension list for the Tiptap editor - kept out of NoteEditor.vue
 * so the component itself stays about wiring (autosave, conflicts,
 * attachments), not extension configuration.
 *
 * StarterKit (v3) already bundles Link and Underline, and renamed History to
 * "undoRedo" - see the Tiptap-Rewrite plan's package inspection notes.
 * TaskList/TaskItem, Image and Placeholder aren't in StarterKit and are
 * added explicitly. StarterKit's Heading/Blockquote/CodeBlock/BulletList/
 * OrderedList/ListItem/HorizontalRule ship their own markdown input rules
 * (`## `, `> `, `` ` `` ```, `- `, `1. `, `---`) - this is what replaces the
 * old `smartEditing.ts`'s narrower hand-rolled equivalent.
 */
export function buildEditorExtensions(options: EditorExtensionsOptions): AnyExtension[] {
  return [
    StarterKit.configure({
      link: { openOnClick: false, autolink: false }
    }),
    Markdown.configure({
      html: false,
      transformPastedText: true,
      transformCopiedText: true
    }),
    Placeholder.configure({
      placeholder: 'Schreib los …'
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    ResolvedImage.configure({ inline: false }),
    UploadPlaceholder,
    Wikilink.configure({ 
      onNavigate: options.onWikilinkNavigate,
      suggestion: options.wikilinkSuggestion || {}
    }),
    SlashCommandExtension.configure({
      slashCommandOptions: options.slashCommandOptions,
      suggestion: options.slashSuggestion || {}
    })
  ]
}
