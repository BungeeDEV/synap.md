import type { EditorView } from '@codemirror/view'
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
  run: (view: EditorView) => void
}

// Order is significant: it's the display/fallback order within each group,
// since filterSlashCommands only narrows this list rather than re-sorting it
// (keeps the grouped layout stable while typing instead of results jumping
// between groups as fuzzy scores shift).
export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'heading-1', label: 'Heading 1', icon: Heading1, group: 'heading', run: (view) => setHeading(view, 1) },
  { id: 'heading-2', label: 'Heading 2', icon: Heading2, group: 'heading', run: (view) => setHeading(view, 2) },
  { id: 'heading-3', label: 'Heading 3', icon: Heading3, group: 'heading', run: (view) => setHeading(view, 3) },
  { id: 'bulleted-list', label: 'Bulleted List', icon: List, group: 'list', run: insertBulletList },
  { id: 'numbered-list', label: 'Numbered List', icon: ListOrdered, group: 'list', run: insertNumberedList },
  { id: 'task-list', label: 'Task List', icon: ListTodo, group: 'list', run: insertTaskList },
  { id: 'quote', label: 'Quote', icon: Quote, group: 'list', run: insertQuote },
  { id: 'code-block', label: 'Code-Block', icon: Code, group: 'insert', run: insertCodeBlock },
  { id: 'link', label: 'Link', icon: Link, group: 'insert', run: insertLink },
  { id: 'wikilink', label: 'Wikilink', icon: AtSign, group: 'insert', run: insertWikilink },
  { id: 'image', label: 'Bild', icon: Image, group: 'insert', run: () => requestAttachmentInsert('image') },
  { id: 'attachment', label: 'Datei-Anhang', icon: Paperclip, group: 'insert', run: () => requestAttachmentInsert('file') },
  { id: 'horizontal-rule', label: 'Horizontal Rule', icon: Minus, group: 'insert', run: insertHorizontalRule }
]

/**
 * Fuzzy-filters (via the same subsequence scorer the command palette and
 * wikilink autocomplete use) rather than the old plain substring match, but
 * deliberately keeps SLASH_COMMANDS' original grouped order instead of
 * re-sorting by score - with only ~13 fixed items, stable grouping while
 * typing matters more than score-ranking a handful of matches.
 */
export function filterSlashCommands(query: string, commands: SlashCommand[] = SLASH_COMMANDS): SlashCommand[] {
  const trimmed = query.trim()
  if (!trimmed) return commands
  return commands.filter((command) => scoreString(trimmed, command.label) >= 0)
}
