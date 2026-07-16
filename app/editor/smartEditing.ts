import { Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

const WRAP_CHARS = new Set(['*', '_', '`'])

/** Wraps a selection, auto-pairs `[[` and backtick, all as one input handler. */
function handleInput(view: EditorView, from: number, to: number, insert: string): boolean {
  const hasSelection = from !== to

  if (hasSelection && WRAP_CHARS.has(insert)) {
    const selected = view.state.sliceDoc(from, to)
    view.dispatch({
      changes: { from, to, insert: insert + selected + insert },
      selection: { anchor: from + insert.length, head: to + insert.length }
    })
    return true
  }

  if (!hasSelection && insert === '[' && view.state.sliceDoc(from - 1, from) === '[') {
    // Second "[" right after an existing one: complete the wikilink pair,
    // cursor lands between "[[" and "]]".
    view.dispatch({
      changes: { from, to, insert: '[]]' },
      selection: { anchor: from + 1 }
    })
    return true
  }

  if (!hasSelection && insert === '`' && view.state.sliceDoc(to, to + 1) !== '`') {
    view.dispatch({
      changes: { from, to, insert: '``' },
      selection: { anchor: from + 1 }
    })
    return true
  }

  return false
}

const LIST_PREFIX_RE = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )/

/**
 * Enter on a list line continues the list with the same prefix (ordered
 * lists increment); Enter on an otherwise-empty list line removes the
 * prefix instead of adding another empty item.
 */
function handleListEnter(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main
  if (!range.empty) return false

  const line = state.doc.lineAt(range.from)
  if (range.from !== line.to) return false

  const match = LIST_PREFIX_RE.exec(line.text)
  if (!match) return false

  const prefix = match[0]
  const isEmptyListLine = line.text === prefix

  if (isEmptyListLine) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from }
    })
    return true
  }

  let nextPrefix = prefix
  const numeral = match[3]
  if (numeral) {
    nextPrefix = prefix.replace(`${numeral}.`, `${Number.parseInt(numeral, 10) + 1}.`)
  }

  const insert = `\n${nextPrefix}`
  view.dispatch({
    changes: { from: range.from, insert },
    selection: { anchor: range.from + insert.length }
  })
  return true
}

export function smartEditing(): Extension {
  return [
    EditorView.inputHandler.of(handleInput),
    // Prec.high, not highest: the slash-menu's Enter binding (Prec.highest)
    // must win when both could apply.
    Prec.high(keymap.of([{ key: 'Enter', run: handleListEnter }]))
  ]
}
