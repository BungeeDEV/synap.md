import { InputRule } from '@tiptap/core'
import { gitHubEmojis } from '@tiptap/extension-emoji'

export const emojiInputRule = new InputRule({
  find: /(?:^|\s)(:([a-zA-Z0-9_+-]+):)\s$/,
  handler: ({ state, range, match }: any) => {
    const { tr } = state
    const emojiName = match[2]
    
    // find emoji in githubEmojis array
    const exists = gitHubEmojis.find(e => e.name === emojiName || e.shortcodes.includes(emojiName))
    
    if (exists) {
      const emojiNode = state.schema.nodes.emoji.create({ name: exists.name })
      // match[0] is the entire string matched, match[1] is the :shortcode:
      const start = range.from + (match[0].length - match[1].length - 1)
      const end = range.to - 1 // we leave the trailing space untouched for the user to continue typing
      
      tr.replaceWith(start, end, emojiNode)
    }
  }
})

import { Extension } from '@tiptap/core'

export const EmojiInputRuleExtension = Extension.create({
  name: 'emojiInputRule',
  addInputRules() {
    return [emojiInputRule]
  }
})
