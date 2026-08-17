import type { Editor } from '@tiptap/core'
import { scoreString } from './fuzzyMatch'

export type SlashCommandGroup = 'text' | 'heading' | 'list' | 'format' | 'insert'

export const SLASH_COMMAND_GROUP_LABELS: Record<SlashCommandGroup, string> = {
  text: 'Text',
  heading: 'Überschriften',
  list: 'Listen',
  format: 'Formatierung',
  insert: 'Einfügen'
}

export interface SlashCommand {
  id: string
  label: string
  icon: string
  group: SlashCommandGroup
  aliases?: string[]
  run: (editor: Editor) => void
}

/** Wraps the current selection (or, with no selection, a freshly inserted placeholder word) in a Link mark - `window.prompt` rather than new BubbleMenu UI, since the BubbleMenu spec only calls for Bold/Italic/Strike/Code. */
function insertLink(editor: Editor, promptLabel: string): void {
  const url = window.prompt(promptLabel)
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

export interface SlashCommandOptions {
  onAttachmentInsert: (type: 'image' | 'file') => void
  linkPromptLabel?: string
}

// Order is significant: it's the display/fallback order within each group,
// since filterSlashCommands only narrows this list rather than re-sorting it
// (keeps the grouped layout stable while typing instead of results jumping
// between groups as fuzzy scores shift).
export const getSlashCommands = (options: SlashCommandOptions): SlashCommand[] => [
  // Text
  { id: 'paragraph', label: 'Text', icon: 'Type', group: 'text', aliases: ['p', 'paragraph', 'text', 'normal'], run: (editor) => editor.chain().focus().setParagraph().run() },

  // Headings
  { id: 'heading-1', label: 'Heading 1', icon: 'Heading1', group: 'heading', aliases: ['h1', 'überschrift 1', 'titel'], run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'heading-2', label: 'Heading 2', icon: 'Heading2', group: 'heading', aliases: ['h2', 'überschrift 2'], run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'heading-3', label: 'Heading 3', icon: 'Heading3', group: 'heading', aliases: ['h3', 'überschrift 3'], run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },

  // Lists
  { id: 'bulleted-list', label: 'Bulleted List', icon: 'List', group: 'list', aliases: ['ul', 'punkt', 'liste'], run: (editor) => editor.chain().focus().toggleBulletList().run() },
  { id: 'numbered-list', label: 'Numbered List', icon: 'ListOrdered', group: 'list', aliases: ['ol', 'nummer', 'liste'], run: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { id: 'task-list', label: 'Task List', icon: 'ListTodo', group: 'list', aliases: ['check', 'todo', 'checkbox', 'aufgabe'], run: (editor) => editor.chain().focus().toggleTaskList().run() },
  { id: 'quote', label: 'Quote', icon: 'Quote', group: 'list', aliases: ['zitat', 'quote', 'blockquote'], run: (editor) => editor.chain().focus().toggleBlockquote().run() },

  // Format
  { id: 'bold', label: 'Fett', icon: 'Bold', group: 'format', aliases: ['b', 'fett', 'bold', 'strong'], run: (editor) => editor.chain().focus().toggleBold().run() },
  { id: 'italic', label: 'Kursiv', icon: 'Italic', group: 'format', aliases: ['i', 'kursiv', 'italic', 'em'], run: (editor) => editor.chain().focus().toggleItalic().run() },
  { id: 'strikethrough', label: 'Durchgestrichen', icon: 'Strikethrough', group: 'format', aliases: ['s', 'strike', 'durchgestrichen', 'del'], run: (editor) => editor.chain().focus().toggleStrike().run() },
  { id: 'code', label: 'Inline-Code', icon: 'Terminal', group: 'format', aliases: ['code', 'inline'], run: (editor) => editor.chain().focus().toggleCode().run() },
  { id: 'highlight', label: 'Markieren', icon: 'Highlighter', group: 'format', aliases: ['mark', 'highlight', 'hervorheben'], run: (editor) => editor.chain().focus().toggleHighlight().run() },

  // Insert
  { id: 'table', label: 'Tabelle', icon: 'Table', group: 'insert', aliases: ['table', 'tabelle', 'grid'], run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'callout-info', label: 'Hinweis', icon: 'Info', group: 'insert', aliases: ['callout', 'hinweis', 'note', 'info'], run: (editor) => editor.chain().focus().insertContent({ type: 'callout', attrs: { type: 'note' }, content: [{ type: 'paragraph' }] }).run() },
  { id: 'callout-warning', label: 'Warnung', icon: 'AlertTriangle', group: 'insert', aliases: ['warnung', 'warning', 'achtung'], run: (editor) => editor.chain().focus().insertContent({ type: 'callout', attrs: { type: 'warning' }, content: [{ type: 'paragraph' }] }).run() },
  { id: 'math-block', label: 'Mathe-Block', icon: 'Sigma', group: 'insert', aliases: ['math', 'mathe', 'latex', 'formel'], run: (editor) => editor.chain().focus().insertContent({ type: 'mathBlock' }).run() },
  { id: 'code-block', label: 'Code-Block', icon: 'Code', group: 'insert', aliases: ['codeblock'], run: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { id: 'link', label: 'Link', icon: 'Link', group: 'insert', aliases: ['link', 'url'], run: (editor) => insertLink(editor, options.linkPromptLabel ?? 'Link-URL') },
  { id: 'wikilink', label: 'Wikilink', icon: 'AtSign', group: 'insert', aliases: ['wiki', 'mention'], run: insertWikilink },
  { id: 'image', label: 'Bild', icon: 'Image', group: 'insert', aliases: ['bild', 'image', 'foto'], run: () => options.onAttachmentInsert('image') },
  { id: 'attachment', label: 'Datei-Anhang', icon: 'Paperclip', group: 'insert', aliases: ['datei', 'file', 'anhang'], run: () => options.onAttachmentInsert('file') },
  { id: 'horizontal-rule', label: 'Horizontal Rule', icon: 'Minus', group: 'insert', aliases: ['hr', 'trennlinie', 'divider', 'strich'], run: (editor) => editor.chain().focus().setHorizontalRule().run() }
]

/**
 * Fuzzy-filters (via the same subsequence scorer the command palette and
 * wikilink autocomplete use) rather than a plain substring match, but
 * deliberately keeps SLASH_COMMANDS' original grouped order instead of
 * re-sorting by score - with only ~13 fixed items, stable grouping while
 * typing matters more than score-ranking a handful of matches.
 */
export function filterSlashCommands(query: string, commands: SlashCommand[]): SlashCommand[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return commands
  
  return commands.filter((command) => {
    // Check main label
    if (scoreString(trimmed, command.label.toLowerCase()) >= 0) return true
    
    // Check aliases
    if (command.aliases && command.aliases.some(alias => scoreString(trimmed, alias.toLowerCase()) >= 0)) {
      return true
    }
    
    return false
  })
}
