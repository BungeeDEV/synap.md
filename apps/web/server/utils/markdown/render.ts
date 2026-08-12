import type Database from 'better-sqlite3'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import type { Root } from 'hast'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { ATTACHMENTS_DIR } from '../attachments'
import { remarkWikilinks } from './remark-wikilinks'
import { resolveWikilinkTargetPath } from './resolve-wikilink-target'

// defaultSchema (github-flavored) doesn't know about our custom wikilink
// attributes - extend just the `a` tag's allowlist rather than loosening
// anything else, so everything else stays as strict as rehype-sanitize's
// defaults.
const schema = structuredClone(defaultSchema)
schema.attributes = schema.attributes ?? {}
schema.attributes.a = [...(schema.attributes.a ?? []), 'data-wikilink-path', 'data-wikilink-broken']

function rewriteIfAttachment(value: string): string {
  if (!value.startsWith(`${ATTACHMENTS_DIR}/`)) return value
  return `/api/vault/attachment?path=${encodeURIComponent(value)}`
}

/**
 * Rewrites `<img src>`/`<a href>` values that point at a relative
 * `_attachments/...` path into the attachment download route - without
 * this, the reader view would request a path the browser can't resolve
 * (there's no static file server for the vault).
 */
function rehypeRewriteAttachmentLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (!('tagName' in node) || typeof node.tagName !== 'string') return
      if (!('properties' in node) || typeof node.properties !== 'object' || node.properties === null) return
      const properties = node.properties as Record<string, unknown>

      if (node.tagName === 'img' && typeof properties.src === 'string') {
        properties.src = rewriteIfAttachment(properties.src)
      }
      if (node.tagName === 'a' && typeof properties.href === 'string') {
        properties.href = rewriteIfAttachment(properties.href)
      }
    })
  }
}

/**
 * Renders raw Markdown to sanitized HTML for the reader view. Wikilinks are
 * resolved against the DB via the same `remarkWikilinks` plugin the indexer
 * uses, so link resolution can't drift between search/backlinks and what's
 * actually shown on screen.
 */
export async function renderMarkdown(db: Database.Database, markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikilinks, (target) => resolveWikilinkTargetPath(db, target))
    .use(remarkRehype)
    .use(rehypeRewriteAttachmentLinks)
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(markdown)

  return String(file)
}
