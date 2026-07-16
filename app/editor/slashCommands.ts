import type { EditorView } from '@codemirror/view'
import {
  AtSign,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote
} from 'lucide-vue-next'
import type { Component } from 'vue'

export interface SlashCommand {
  id: string
  label: string
  icon: Component
  run: (view: EditorView) => void
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'heading-1', label: 'Heading 1', icon: Heading1, run: (view) => setHeading(view, 1) },
  { id: 'heading-2', label: 'Heading 2', icon: Heading2, run: (view) => setHeading(view, 2) },
  { id: 'heading-3', label: 'Heading 3', icon: Heading3, run: (view) => setHeading(view, 3) },
  { id: 'bulleted-list', label: 'Bulleted List', icon: List, run: insertBulletList },
  { id: 'numbered-list', label: 'Numbered List', icon: ListOrdered, run: insertNumberedList },
  { id: 'task-list', label: 'Task List', icon: ListTodo, run: insertTaskList },
  { id: 'quote', label: 'Quote', icon: Quote, run: insertQuote },
  { id: 'code-block', label: 'Code-Block', icon: Code, run: insertCodeBlock },
  { id: 'wikilink', label: 'Wikilink', icon: AtSign, run: insertWikilink },
  { id: 'horizontal-rule', label: 'Horizontal Rule', icon: Minus, run: insertHorizontalRule }
]

/** Simple case-insensitive substring filter over the static command list - not worth reshaping fuzzyMatch.ts's FileEntry-shaped scorer for 10 fixed items. */
export function filterSlashCommands(query: string, commands: SlashCommand[] = SLASH_COMMANDS): SlashCommand[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return commands
  return commands.filter((command) => command.label.toLowerCase().includes(trimmed))
}
