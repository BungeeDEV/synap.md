import type { Editor } from '@tiptap/core'
import {
  AtSign,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Paperclip,
  Quote
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { scoreString } from '~/utils/fuzzyMatch'

export type SlashCommandGroup = 'heading' | 'list' | 'insert'

export const SLASH_COMMAND_GROUP_LABELS: Record<SlashCommandGroup, string> = {
  heading: 'Überschriften',
  list: 'Listen',
  insert: 'Einfügen'
}

export interface SlashCommand {
  id: string
  label: string
  icon: Component
  group: SlashCommandGroup
  run: (editor: Editor) => void
}

/** Wraps the current selection (or, with no selection, a freshly inserted placeholder word) in a Link mark - `window.prompt` rather than new BubbleMenu UI, since the BubbleMenu spec only calls for Bold/Italic/Strike/Code. */
function insertLink(editor: Editor): void {
  const url = window.prompt('Link-URL')
  if (!url) return

  const { from, to } = editor.state.selection
  if (from === to) {
    editor.chain().focus().insertContent(url).run()
    editor.chain().setTextSelection({ from, to: from + url.length }).setLink({ href: url }).run()
  } else {
    editor.chain().focus().setLink({ href: url }).run()
  }
}

/** Types the "[[" trigger text, which the Wikilink extension's own Suggestion plugin picks up exactly like manual typing - reuses the whole autocomplete UX instead of duplicating it. */
function insertWikilink(editor: Editor): void {
  editor.chain().focus().insertContent('[[').run()
}

// Order is significant: it's the display/fallback order within each group,
// since filterSlashCommands only narrows this list rather than re-sorting it
// (keeps the grouped layout stable while typing instead of results jumping
// between groups as fuzzy scores shift).
export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'heading-1', label: 'Heading 1', icon: Heading1, group: 'heading', run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'heading-2', label: 'Heading 2', icon: Heading2, group: 'heading', run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'heading-3', label: 'Heading 3', icon: Heading3, group: 'heading', run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'bulleted-list', label: 'Bulleted List', icon: List, group: 'list', run: (editor) => editor.chain().focus().toggleBulletList().run() },
  { id: 'numbered-list', label: 'Numbered List', icon: ListOrdered, group: 'list', run: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { id: 'task-list', label: 'Task List', icon: ListTodo, group: 'list', run: (editor) => editor.chain().focus().toggleTaskList().run() },
  { id: 'quote', label: 'Quote', icon: Quote, group: 'list', run: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { id: 'code-block', label: 'Code-Block', icon: Code, group: 'insert', run: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { id: 'link', label: 'Link', icon: Link, group: 'insert', run: insertLink },
  { id: 'wikilink', label: 'Wikilink', icon: AtSign, group: 'insert', run: insertWikilink },
  { id: 'image', label: 'Bild', icon: Image, group: 'insert', run: () => requestAttachmentInsert('image') },
  { id: 'attachment', label: 'Datei-Anhang', icon: Paperclip, group: 'insert', run: () => requestAttachmentInsert('file') },
  { id: 'horizontal-rule', label: 'Horizontal Rule', icon: Minus, group: 'insert', run: (editor) => editor.chain().focus().setHorizontalRule().run() }
]

/**
 * Fuzzy-filters (via the same subsequence scorer the command palette and
 * wikilink autocomplete use) rather than a plain substring match, but
 * deliberately keeps SLASH_COMMANDS' original grouped order instead of
 * re-sorting by score - with only ~13 fixed items, stable grouping while
 * typing matters more than score-ranking a handful of matches.
 */
export function filterSlashCommands(query: string, commands: SlashCommand[] = SLASH_COMMANDS): SlashCommand[] {
  const trimmed = query.trim()
  if (!trimmed) return commands
  return commands.filter((command) => scoreString(trimmed, command.label) >= 0)
}
