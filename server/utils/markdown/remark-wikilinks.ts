import { visit } from 'unist-util-visit'

// [[Target]] or [[Target|Alias]]. Wikilinks aren't part of CommonMark/GFM, so
// they survive markdown parsing as plain text and are pulled out of `text`
// nodes here rather than via a dedicated inline tokenizer.
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export interface ResolvedWikilink {
  path: string | null
}

export type WikilinkResolver = (rawTarget: string) => ResolvedWikilink

/**
 * Shape of `node.data` on every mdast node this plugin generates.
 * `wikilinkRaw` (the verbatim text between `[[` and `]]`, untrimmed, alias
 * included) is what the indexer needs for its `target_raw` column - kept as
 * a plain `data` field rather than an `hProperty` since it has no business
 * becoming an HTML attribute.
 */
export interface WikilinkNodeData {
  wikilinkRaw: string
  hProperties: Record<string, string | undefined>
}

/**
 * Remark plugin: rewrites `[[Target]]` / `[[Target|Alias]]` text into mdast
 * `link` nodes, so the indexer (extraction) and the reader pipeline
 * (rendering) share one wikilink implementation instead of drifting apart.
 *
 * Resolved links get `data-wikilink-path`; unresolved ones get
 * `data-wikilink-broken` instead - both via `data.hProperties`, which
 * mdast-util-to-hast/remark-rehype apply straight onto the resulting `<a>`.
 * For the broken case, `href` is explicitly unset via `hProperties.href =
 * undefined` (mdast-util-to-hast would otherwise emit `href=""` from the
 * empty `url`, which browsers resolve to the current document and would
 * navigate/reload the page on click).
 */
export function remarkWikilinks(resolve: WikilinkResolver) {
  return (tree: object) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (!('value' in node) || typeof node.value !== 'string') return
      if (!('children' in parent) || !Array.isArray(parent.children)) return

      const value = node.value
      WIKILINK_PATTERN.lastIndex = 0
      if (!WIKILINK_PATTERN.test(value)) return
      WIKILINK_PATTERN.lastIndex = 0

      const newNodes: object[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = WIKILINK_PATTERN.exec(value))) {
        const [full, rawTarget, alias] = match as unknown as [string, string, string | undefined]

        if (match.index > lastIndex) {
          newNodes.push({ type: 'text', value: value.slice(lastIndex, match.index) })
        }

        const target = rawTarget.trim()
        const display = (alias ?? rawTarget).trim()
        const resolved = resolve(target)

        const wikilinkRaw = full.slice(2, -2)

        newNodes.push(
          resolved.path
            ? {
                type: 'link',
                url: resolved.path,
                title: null,
                children: [{ type: 'text', value: display }],
                data: {
                  wikilinkRaw,
                  hProperties: { 'data-wikilink-path': resolved.path }
                } satisfies WikilinkNodeData
              }
            : {
                type: 'link',
                url: '',
                title: null,
                children: [{ type: 'text', value: display }],
                data: {
                  wikilinkRaw,
                  hProperties: { href: undefined, 'data-wikilink-broken': 'true' }
                } satisfies WikilinkNodeData
              }
        )

        lastIndex = match.index + full.length
      }

      if (lastIndex < value.length) {
        newNodes.push({ type: 'text', value: value.slice(lastIndex) })
      }

      parent.children.splice(index, 1, ...newNodes)
      return index + newNodes.length
    })
  }
}
