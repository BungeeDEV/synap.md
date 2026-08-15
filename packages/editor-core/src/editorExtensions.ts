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
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Highlight from '@tiptap/extension-highlight'
import { MathInline, MathBlock, MathLiveExtension } from './mathLivePreview'
import { EmojiInputRuleExtension } from './emojiInputRule'
import Emoji, { gitHubEmojis } from '@tiptap/extension-emoji'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import markdownItMark from 'markdown-it-mark'
import texmath from 'markdown-it-texmath'
import { full as markdownItEmoji } from 'markdown-it-emoji'
import katex from 'katex'
import { Callout, DefinitionList, DefinitionTerm, DefinitionDescription } from './customNodes'
import { TrailingNode } from './trailingNode'
import { TableFixExtension } from './tableFix'

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
/**
 * Patch Canvas2D to suppress Chromium's `willReadFrequently` warning
 * triggered by Tiptap's Emoji extension when it checks for native emoji support.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
    options?: any
  ): any {
    if (contextId === '2d') {
      options = { ...(options || {}), willReadFrequently: true }
    }
    return originalGetContext.call(this, contextId as any, options)
  }
}

export function buildEditorExtensions(options: EditorExtensionsOptions): AnyExtension[] {
  return [
    StarterKit.configure({
      link: { openOnClick: false, autolink: false }
    }),
    Markdown.configure({
      html: false,
      breaks: true,
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
    Subscript,
    Superscript,
    Highlight.extend({
      addStorage() {
        return {
          ...(this.parent?.() as any),
          markdown: {
            parse: {
              setup(md: any) {
                md.use(markdownItMark)
              }
            }
          }
        }
      }
    }).configure({
      HTMLAttributes: { class: 'highlight' }
    }),
    MathInline,
    MathBlock,
    MathLiveExtension,
    Emoji.extend({
      addStorage() {
        return {
          ...(this.parent?.() as any),
          markdown: {
            serialize(state: any, node: any) {
              state.write(node.attrs.name ? `:${node.attrs.name}:` : '')
            },
            parse: {
              setup(md: any) {
                md.use(markdownItEmoji)
                md.renderer.rules.emoji = (tokens: any, idx: number) => {
                  return `<span data-type="emoji" data-name="${tokens[idx].markup}"></span>`
                }
              }
            }
          }
        }
      }
    }).configure({
      emojis: gitHubEmojis,
      enableEmoticons: false
    }),
    EmojiInputRuleExtension,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Callout,
    DefinitionList,
    DefinitionTerm,
    DefinitionDescription,
    TrailingNode,
    TableFixExtension,
    SlashCommandExtension.configure({
      slashCommandOptions: options.slashCommandOptions,
      suggestion: options.slashSuggestion || {}
    })
  ]
}
