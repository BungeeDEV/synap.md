import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/** Wraps every selection range with `before`/`after`, keeping the original selection inside the wrap. */
export function wrapSelection(view: EditorView, before: string, after: string = before): void {
  const tr = view.state.changeByRange((range) => ({
    changes: [{ from: range.from, insert: before }, { from: range.to, insert: after }],
    range: EditorSelection.range(range.from + before.length, range.to + before.length)
  }))
  view.dispatch(view.state.update(tr))
  view.focus()
}

/** Prefixes every line touched by any selection range. `prefixFor` receives the 0-based index within that range's line span. */
export function prefixLines(view: EditorView, prefixFor: (index: number) => string): void {
  const tr = view.state.changeByRange((range) => {
    const doc = view.state.doc
    const firstLine = doc.lineAt(range.from).number
    const lastLine = doc.lineAt(range.to).number

    const changes: { from: number, insert: string }[] = []
    let shiftBeforeFrom = 0
    let shiftBeforeTo = 0

    for (let i = 0; i <= lastLine - firstLine; i++) {
      const line = doc.line(firstLine + i)
      const prefix = prefixFor(i)
      changes.push({ from: line.from, insert: prefix })
      if (line.from <= range.from) shiftBeforeFrom += prefix.length
      if (line.from <= range.to) shiftBeforeTo += prefix.length
    }

    return { changes, range: EditorSelection.range(range.from + shiftBeforeFrom, range.to + shiftBeforeTo) }
  })
  view.dispatch(view.state.update(tr))
  view.focus()
}

/** Shared by `cycleHeading` and `setHeading`: replaces the current line's ATX heading marker. */
function applyHeading(view: EditorView, nextLevel: 0 | 1 | 2 | 3): void {
  const tr = view.state.changeByRange((range) => {
    const line = view.state.doc.lineAt(range.from)
    const match = /^(#{1,3})\s/.exec(line.text)
    const oldPrefixLength = match ? match[0].length : 0
    const newPrefix = nextLevel === 0 ? '' : '#'.repeat(nextLevel) + ' '
    const delta = newPrefix.length - oldPrefixLength

    return {
      changes: { from: line.from, to: line.from + oldPrefixLength, insert: newPrefix },
      range: EditorSelection.range(
        Math.max(line.from, range.from + delta),
        Math.max(line.from, range.to + delta)
      )
    }
  })
  view.dispatch(view.state.update(tr))
  view.focus()
}

/** Cycles the current line through H1 -> H2 -> H3 -> plain text -> H1 ... */
export function cycleHeading(view: EditorView): void {
  const line = view.state.doc.lineAt(view.state.selection.main.from)
  const match = /^(#{1,3})\s/.exec(line.text)
  const currentLevel = match ? match[1]!.length : 0
  const nextLevel = currentLevel >= 3 ? 0 : currentLevel + 1
  applyHeading(view, nextLevel as 0 | 1 | 2 | 3)
}

/** Sets the current line to a specific heading level. */
export function setHeading(view: EditorView, level: 1 | 2 | 3): void {
  applyHeading(view, level)
}

export function insertLink(view: EditorView): void {
  const tr = view.state.changeByRange((range) => {
    const selectedText = view.state.sliceDoc(range.from, range.to)
    const insert = `[${selectedText}]()`
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + selectedText.length + 3)
    }
  })
  view.dispatch(view.state.update(tr))
  view.focus()
}

export function insertWikilink(view: EditorView): void {
  const tr = view.state.changeByRange((range) => ({
    changes: { from: range.from, to: range.to, insert: '[[]]' },
    range: EditorSelection.cursor(range.from + 2)
  }))
  view.dispatch(view.state.update(tr))
  view.focus()
}

export function insertBulletList(view: EditorView): void {
  prefixLines(view, () => '- ')
}

export function insertNumberedList(view: EditorView): void {
  prefixLines(view, (i) => `${i + 1}. `)
}

export function insertTaskList(view: EditorView): void {
  prefixLines(view, () => '- [ ] ')
}

export function insertQuote(view: EditorView): void {
  prefixLines(view, () => '> ')
}

/** Wraps the selection in a fenced code block; with no selection, places the cursor on the empty line between the fences. */
export function insertCodeBlock(view: EditorView): void {
  const tr = view.state.changeByRange((range) => {
    const selectedText = view.state.sliceDoc(range.from, range.to)
    const insert = `\`\`\`\n${selectedText}\n\`\`\``
    const cursorPos = range.from + 4 + selectedText.length
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(cursorPos)
    }
  })
  view.dispatch(view.state.update(tr))
  view.focus()
}

/** Inserts a horizontal rule on its own line, cursor on a new line after it. */
export function insertHorizontalRule(view: EditorView): void {
  const tr = view.state.changeByRange((range) => {
    const insert = '---\n'
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length)
    }
  })
  view.dispatch(view.state.update(tr))
  view.focus()
}
