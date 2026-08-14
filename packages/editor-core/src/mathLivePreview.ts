import { Decoration, DecorationSet } from '@tiptap/pm/view'
import katex from 'katex'
import { Mark, Node, mergeAttributes } from '@tiptap/core'
import texmath from 'markdown-it-texmath'

export const MathInline = Mark.create({
  name: 'mathInline',
  parseHTML() { return [{ tag: 'span[data-math-inline]' }] },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }), 0] },
  addStorage() {
    return {
      markdown: {
        serialize: { open: '$', close: '$', escape: false },
        parse: { 
          setup(md: any) {
            const escapeHtml = md.utils.escapeHtml
            md.use(texmath, { delimiters: 'dollars' })
            md.renderer.rules.math_inline = (tokens: any, idx: number) => {
              return `<span data-math-inline="">${escapeHtml(tokens[idx].content)}</span>`
            }
            md.renderer.rules.math_inline_double = (tokens: any, idx: number) => {
              return `<div data-math-block="">${escapeHtml(tokens[idx].content)}</div>`
            }
            md.renderer.rules.math_block = (tokens: any, idx: number) => {
              return `<div data-math-block="">${escapeHtml(tokens[idx].content)}</div>`
            }
          }
        }
      }
    }
  }
})

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  parseHTML() { return [{ tag: 'div[data-math-block]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), 0] },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write('$$\n')
          state.text(node.textContent.trim(), false)
          state.write('\n$$\n')
        },
        parse: { setup() {} }
      }
    }
  }
})

function getMathDecorations(doc: any, selection: any) {
  const decorations: Decoration[] = []
  
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'mathBlock') {
      const isSelected = selection.from <= pos + node.nodeSize && selection.to >= pos
      if (!isSelected) {
        const dom = document.createElement('div')
        dom.className = 'katex-live-render block-math-render my-4 px-4 py-2 bg-base-subtle rounded-md'
        try {
          katex.render(node.textContent, dom, { displayMode: true, throwOnError: false })
        } catch (e) {
          dom.textContent = node.textContent
        }
        decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'hidden' }))
        decorations.push(Decoration.widget(pos, dom))
      }
      return false
    }
    
    if (node.isText && node.marks) {
      const mathMark = node.marks.find((m: any) => m.type.name === 'mathInline')
      if (mathMark) {
        const isSelected = selection.from <= pos + node.nodeSize && selection.to >= pos
        if (!isSelected) {
          const dom = document.createElement('span')
          dom.className = 'katex-live-render inline-math-render'
          try {
            katex.render(node.text, dom, { throwOnError: false })
          } catch(e) {
            dom.textContent = node.text
          }
          decorations.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'opacity-0 text-[0px] w-0' }))
          decorations.push(Decoration.widget(pos, dom))
        }
      }
    }
  })
  
  return DecorationSet.create(doc, decorations)
}

export const MathLivePlugin = new Plugin({
  key: new PluginKey('mathLivePlugin'),
  state: {
    init(_, { doc, selection }) {
      return getMathDecorations(doc, selection)
    },
    apply(tr, old, oldState, newState) {
      if (tr.docChanged || tr.selectionSet) {
        return getMathDecorations(newState.doc, newState.selection)
      }
      return old
    }
  },
  props: {
    decorations(state) {
      return this.getState(state)
    }
  }
})

import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Extension } from '@tiptap/core'

export const MathLiveExtension = Extension.create({
  name: 'mathLive',
  addProseMirrorPlugins() {
    return [MathLivePlugin]
  }
})
