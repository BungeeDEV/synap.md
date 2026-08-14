import { Extension } from '@tiptap/core'

export const TableFixExtension = Extension.create({
  name: 'tableFix',

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        const { $from, empty } = selection

        // Only handle if selection is empty and at the start of a node
        if (!empty || $from.parentOffset !== 0) {
          return false
        }

        // Check if we are inside a table
        let isTable = false
        let rowIndex = -1
        let rowNode = null
        let rowPos = -1

        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (node.type.name === 'tableRow') {
            isTable = true
            rowNode = node
            rowIndex = $from.index(d - 1)
            rowPos = $from.before(d)
            break
          }
        }

        if (isTable && rowNode) {
          // Check if the ENTIRE row is completely empty
          // A row is empty if its textContent is empty and it contains no block elements like images
          if (rowNode.textContent.trim() === '' && rowNode.content.size <= rowNode.childCount * 4) {
             // In ProseMirror, an empty cell has size 4: cell start(1) + p start(1) + p end(1) + cell end(1)
             // So an empty row has size <= cellCount * 4
             
             // If we are in an empty row, delete it!
             editor.commands.deleteRow()
             return true
          }
        }

        return false
      }
    }
  }
})
