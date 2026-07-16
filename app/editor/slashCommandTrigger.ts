import { Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import type { SlashCommand } from '~/editor/slashCommands'
import { filterSlashCommands } from '~/editor/slashCommands'

export interface SlashMenuState {
  triggerPos: number
  query: string
  selectedIndex: number
  coords: { left: number, top: number }
}

/** Shared with SlashCommandMenu.vue - only one CM6 instance/tab is ever mounted at a time, same reasoning as VaultTree's contextMenu useState. */
export function useSlashCommandMenu() {
  return useState<SlashMenuState | null>('slashCommandMenu', () => null)
}

/** Clears the "/query" line, then runs the command - shared by the keymap below and SlashCommandMenu.vue's click handler so keyboard and mouse selection can never diverge. */
export function executeSlashCommand(view: EditorView, command: SlashCommand): void {
  const state = useSlashCommandMenu()
  const menu = state.value
  if (!menu) return

  const line = view.state.doc.lineAt(menu.triggerPos)
  view.dispatch({ changes: { from: line.from, to: line.to, insert: '' } })
  state.value = null
  command.run(view)
}

function syncSlashMenu(view: EditorView): void {
  const state = useSlashCommandMenu()
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const match = /^\/(\S*)$/.exec(line.text)

  if (!match || pos !== line.to) {
    if (state.value) state.value = null
    return
  }

  const coords = view.coordsAtPos(line.from)
  if (!coords) return

  const query = match[1] ?? ''
  const previous = state.value
  state.value = {
    triggerPos: line.from,
    query,
    selectedIndex: previous && previous.query === query ? previous.selectedIndex : 0,
    coords: { left: coords.left, top: coords.bottom }
  }
}

function moveSelection(delta: number): boolean {
  const state = useSlashCommandMenu()
  const menu = state.value
  if (!menu) return false

  const count = filterSlashCommands(menu.query).length
  if (count === 0) return true

  state.value = { ...menu, selectedIndex: (menu.selectedIndex + delta + count) % count }
  return true
}

/** CM6 extension: detects a lone "/query" line and drives useSlashCommandMenu(); actual selection/execution keybindings are Prec.highest so they always win over smartEditing's list-Enter and defaultKeymap. */
export function slashCommandTrigger(): Extension {
  return [
    EditorView.updateListener.of((update) => {
      if (update.docChanged || update.selectionSet) syncSlashMenu(update.view)
    }),
    Prec.highest(keymap.of([
      { key: 'ArrowDown', run: () => moveSelection(1) },
      { key: 'ArrowUp', run: () => moveSelection(-1) },
      {
        key: 'Escape',
        run: () => {
          const state = useSlashCommandMenu()
          if (!state.value) return false
          state.value = null
          return true
        }
      },
      {
        key: 'Enter',
        run: (view) => {
          const state = useSlashCommandMenu()
          const menu = state.value
          if (!menu) return false
          const filtered = filterSlashCommands(menu.query)
          const command = filtered[menu.selectedIndex]
          if (command) executeSlashCommand(view, command)
          else state.value = null
          return true
        }
      },
      {
        key: 'Tab',
        run: (view) => {
          const state = useSlashCommandMenu()
          const menu = state.value
          if (!menu) return false
          const filtered = filterSlashCommands(menu.query)
          const command = filtered[menu.selectedIndex]
          if (command) executeSlashCommand(view, command)
          else state.value = null
          return true
        }
      }
    ]))
  ]
}
