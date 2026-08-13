import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import markdownItContainer from 'markdown-it-container'
import markdownItDeflist from 'markdown-it-deflist'

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: element => element.getAttribute('data-type') || 'note',
        renderHTML: attributes => ({
          'data-type': attributes.type,
          class: `callout callout-${attributes.type}`,
        }),
      },
    }
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^:::([a-z]+)\s$/,
        type: this.type,
        getAttributes: match => {
          return { type: match[1] }
        }
      })
    ]
  },

  parseHTML() {
    return [
      { tag: 'div.callout' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`:::${node.attrs.type}\n`)
          state.renderContent(node)
          state.write('\n:::\n\n')
        },
        parse: {
          setup(markdownit: any) {
            const types = ['note', 'tip', 'warning', 'danger', 'info']
            const containerPlugin = (markdownItContainer as any).default || markdownItContainer
            for (const type of types) {
              markdownit.use(containerPlugin, type, {
                render(tokens: any, idx: number) {
                  if (tokens[idx].nesting === 1) {
                    return `<div class="callout callout-${type}" data-type="${type}">\n`
                  } else {
                    return '</div>\n'
                  }
                }
              })
            }
          }
        }
      }
    }
  }
})

export const DefinitionList = Node.create({
  name: 'definitionList',
  group: 'block',
  content: '(definitionTerm definitionDescription+)+',

  parseHTML() {
    return [{ tag: 'dl' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['dl', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderContent(node)
          state.write('\n')
        },
        parse: {
          setup(markdownit: any) {
            markdownit.use(markdownItDeflist)
          }
        }
      }
    }
  }
})

export const DefinitionTerm = Node.create({
  name: 'definitionTerm',
  content: 'inline*',
  defining: true,
  parseHTML() { return [{ tag: 'dt' }] },
  renderHTML({ HTMLAttributes }) { return ['dt', mergeAttributes(HTMLAttributes), 0] },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderInline(node)
          state.write('\n')
        }
      }
    }
  }
})

export const DefinitionDescription = Node.create({
  name: 'definitionDescription',
  content: 'block+',
  defining: true,
  parseHTML() { return [{ tag: 'dd' }] },
  renderHTML({ HTMLAttributes }) { return ['dd', mergeAttributes(HTMLAttributes), 0] },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(': ')
          state.renderContent(node)
          state.write('\n')
        }
      }
    }
  }
})
