import { syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'

/**
 * "Live" mode (Obsidian-style Live Preview): markup characters (#, **, `,
 * >, - , [...](...), ![...](...)) are concealed everywhere except the
 * block/span the cursor is currently inside, where the raw Markdown is
 * shown so it stays editable. Concealment is a Decoration.replace (with or
 * without a rendered widget in its place) - the raw characters stay in the
 * document, they're just not rendered - so normal cursor/selection/undo
 * behavior needs no special-casing.
 *
 * Font/color/weight rendering (headings bigger, bold/italic styled, links
 * colored, ...) is already handled by NoteEditor.vue's syntaxHighlighting
 * setup - this extension adds the other half of Live Preview: hiding raw
 * syntax when it's not being edited, and rendering images/checkboxes/rules
 * inline. Deliberately out of scope: tables and fenced code blocks stay
 * raw always - live-rendering a multi-line block as a single widget is a
 * meaningfully bigger (and much more fragile) feature than concealing
 * single-line/single-span marks, so it's left for a dedicated follow-up.
 */

const HIDE = Decoration.replace({})

class BulletWidget extends WidgetType {
  override eq(): boolean { return true }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.textContent = '•'
    span.className = 'text-content-tertiary'
    return span
  }
}

const BULLET = Decoration.replace({ widget: new BulletWidget() })

class HrWidget extends WidgetType {
  override eq(): boolean { return true }
  override toDOM(): HTMLElement {
    const hr = document.createElement('div')
    hr.className = 'my-2 border-t border-border-strong'
    return hr
  }
}

const HORIZONTAL_RULE = Decoration.replace({ widget: new HrWidget() })

class ImageWidget extends WidgetType {
  constructor(private readonly alt: string, private readonly src: string) { super() }
  override eq(other: ImageWidget): boolean { return other.alt === this.alt && other.src === this.src }
  override toDOM(): HTMLElement {
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.loading = 'lazy'
    img.className = 'my-1 inline-block max-h-80 max-w-full rounded-md align-middle'
    return img
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean, private readonly toggle: () => void) { super() }
  override eq(other: CheckboxWidget): boolean { return other.checked === this.checked }
  override toDOM(): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'mx-1 h-3.5 w-3.5 accent-accent align-middle'
    // mousedown, not click: preventDefault here stops both the checkbox's
    // own native toggle and CodeMirror's default click handling (which
    // would otherwise plant the cursor inside the now-hidden "[ ]" range) -
    // the widget's displayed state is driven entirely by re-reading the
    // document after `toggle()` dispatches the underlying text change.
    input.addEventListener('mousedown', (event) => {
      event.preventDefault()
      this.toggle()
    })
    return input
  }

  override ignoreEvent(): boolean { return false }
}

/** `_attachments/...` (relative, vault-local) needs the download route; anything else (external URL) is used as-is. */
function resolveImageSrc(rawUrl: string): string {
  if (!rawUrl.startsWith('_attachments/')) return rawUrl
  return `/api/vault/attachment?path=${encodeURIComponent(rawUrl)}`
}

const IMAGE_SYNTAX_RE = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)$/

function selectionOverlaps(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from)
}

/** Extends a hidden mark's end past one trailing space, so "## "/"- " doesn't leave a stray leading space once the mark itself is concealed. */
function hideThroughTrailingSpace(view: EditorView, to: number): number {
  return view.state.sliceDoc(to, to + 1) === ' ' ? to + 1 : to
}

function lineOf(view: EditorView, pos: number): { from: number, to: number } {
  const line = view.state.doc.lineAt(pos)
  return { from: line.from, to: line.to }
}

interface Piece { from: number, to: number, deco: Decoration }

function buildDecorations(view: EditorView): DecorationSet {
  const pieces: Piece[] = []

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.type.name

        if (name === 'HeaderMark' || name === 'QuoteMark') {
          const line = lineOf(view, node.from)
          if (!selectionOverlaps(view, line.from, line.to)) {
            pieces.push({ from: node.from, to: hideThroughTrailingSpace(view, node.to), deco: HIDE })
          }
          return
        }

        if (name === 'HorizontalRule') {
          const line = lineOf(view, node.from)
          if (!selectionOverlaps(view, line.from, line.to)) {
            pieces.push({ from: node.from, to: node.to, deco: HORIZONTAL_RULE })
          }
          return
        }

        if (name === 'ListMark') {
          const listItem = node.node.parent
          const list = listItem?.parent
          if (!listItem || list?.type.name !== 'BulletList') return

          const line = lineOf(view, node.from)
          if (selectionOverlaps(view, line.from, line.to)) return

          // A task item's checkbox is the marker - showing a bullet dot in
          // front of it too would just be visual clutter.
          let hasTask = false
          for (let child = listItem.firstChild; child; child = child.nextSibling) {
            if (child.type.name === 'Task') { hasTask = true; break }
          }

          const to = hideThroughTrailingSpace(view, node.to)
          pieces.push({ from: node.from, to, deco: hasTask ? HIDE : BULLET })
          return
        }

        if (name === 'TaskMarker') {
          const checked = view.state.sliceDoc(node.from, node.to).toLowerCase() === '[x]'
          const markFrom = node.from
          const markTo = node.to
          pieces.push({
            from: markFrom,
            to: markTo,
            deco: Decoration.replace({
              widget: new CheckboxWidget(checked, () => {
                view.dispatch({ changes: { from: markFrom, to: markTo, insert: checked ? '[ ]' : '[x]' } })
              })
            })
          })
          return
        }

        if (name === 'EmphasisMark' || name === 'StrikethroughMark') {
          const parent = node.node.parent
          if (parent && !selectionOverlaps(view, parent.from, parent.to)) {
            pieces.push({ from: node.from, to: node.to, deco: HIDE })
          }
          return
        }

        if (name === 'CodeMark') {
          const parent = node.node.parent
          // CodeMark is also used for fenced ```code blocks - only conceal
          // the inline `code` variant, fenced blocks always stay raw.
          if (parent?.type.name === 'InlineCode' && !selectionOverlaps(view, parent.from, parent.to)) {
            pieces.push({ from: node.from, to: node.to, deco: HIDE })
          }
          return
        }

        if (name === 'Image') {
          if (selectionOverlaps(view, node.from, node.to)) return
          const parsed = IMAGE_SYNTAX_RE.exec(view.state.sliceDoc(node.from, node.to))
          if (!parsed) return
          const [, alt, url] = parsed
          pieces.push({
            from: node.from,
            to: node.to,
            deco: Decoration.replace({ widget: new ImageWidget(alt ?? '', resolveImageSrc(url ?? '')) })
          })
          return
        }

        if (name === 'Link') {
          if (selectionOverlaps(view, node.from, node.to)) return
          let child = node.node.firstChild
          while (child) {
            if (child.type.name === 'LinkMark' || child.type.name === 'URL') {
              pieces.push({ from: child.from, to: child.to, deco: HIDE })
            }
            child = child.nextSibling
          }
        }
      }
    })
  }

  pieces.sort((a, b) => a.from - b.from)
  const builder = new RangeSetBuilder<Decoration>()
  for (const piece of pieces) builder.add(piece.from, piece.to, piece.deco)
  return builder.finish()
}

export function livePreview(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )
}
