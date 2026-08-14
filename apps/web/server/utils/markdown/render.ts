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

import remarkFrontmatter from 'remark-frontmatter'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import remarkSupersub from 'remark-supersub'
import remarkDefinitionList, { defListHastHandlers } from 'remark-definition-list'
import remarkGemoji from 'remark-gemoji'
import remarkSmartypants from 'remark-smartypants'
import rehypeKatex from 'rehype-katex'
import yaml from 'yaml'

// defaultSchema (github-flavored) doesn't know about our custom wikilink
// attributes - extend just the `a` tag's allowlist rather than loosening
// anything else, so everything else stays as strict as rehype-sanitize's
// defaults.
const schema = structuredClone(defaultSchema)
schema.attributes = schema.attributes ?? {}
schema.attributes.a = [...(schema.attributes.a ?? []), 'data-wikilink-path', 'data-wikilink-broken']
// Phase 6: Sanitize-Schema-Audit - explicitly allow new nodes
schema.tagNames = [...(schema.tagNames ?? []), 'dl', 'dt', 'dd', 'sub', 'sup', 'mark', 'br', 'span', 'div', 'math']
schema.attributes.div = [...(schema.attributes.div ?? []), ['className', /^math(-display)?$/, /^callout(-[a-z]+)?$/], 'data-directive']
schema.attributes.span = [...(schema.attributes.span ?? []), ['className', /^math(-inline)?$/]]

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

function extractFrontmatter() {
  return function (tree: any, file: any) {
    visit(tree, 'yaml', (node) => {
      try {
        file.data.frontmatter = yaml.parse(node.value)
      } catch (e) {
        file.data.frontmatter = null
      }
    })
  }
}

function remarkHighlight() {
  return (tree: any) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent) return;
      const regex = /==([^=]+)==/g;
      if (!regex.test(node.value)) return;
      
      const children: any[] = [];
      let lastIndex = 0;
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(node.value)) !== null) {
        if (match.index > lastIndex) {
          children.push({ type: 'text', value: node.value.slice(lastIndex, match.index) });
        }
        children.push({
          type: 'mark',
          data: { hName: 'mark' },
          children: [{ type: 'text', value: match[1] }]
        });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < node.value.length) {
        children.push({ type: 'text', value: node.value.slice(lastIndex) });
      }
      parent.children.splice(index!, 1, ...children);
      return index! + children.length; // skip the new nodes
    });
  }
}

const CALLOUT_TYPES = ['note', 'tip', 'warning', 'danger', 'info'];

function remarkCalloutDirectives() {
  return (tree: any) => {
    visit(tree, (node) => {
      if (node.type === 'containerDirective' || node.type === 'leafDirective') {
        const type = node.name;
        node.data = node.data || {};
        node.data.hName = 'div';
        if (CALLOUT_TYPES.includes(type)) {
          node.data.hProperties = { className: ['callout', `callout-${type}`] };
        } else {
          node.data.hProperties = { 'data-directive': type };
        }
      }
    });
  }
}

function remarkObsidianCallouts() {
  return (tree: any) => {
    visit(tree, 'blockquote', (node) => {
      if (node.children.length > 0 && node.children[0].type === 'paragraph') {
        const p = node.children[0];
        if (p.children.length > 0 && p.children[0].type === 'text') {
          const textNode = p.children[0];
          const match = textNode.value.match(/^\[!(\w+)\](?:[+-])?\s*(.*)$/m);
          if (match) {
            const type = match[1].toLowerCase();
            const title = match[2];
            node.data = node.data || {};
            node.data.hName = 'div';
            node.data.hProperties = { className: ['callout', `callout-${type}`] };
            
            textNode.value = textNode.value.slice(match[0].length);
            if (!textNode.value.trim() && !title) {
               p.children.shift();
            } else if (title) {
               // Optional: Title rendering logic can be added later
            }
          }
        }
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
export async function renderMarkdown(
  db: Database.Database, 
  markdown: string, 
  useSmartypants = false
): Promise<{ html: string, frontmatter: any }> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(extractFrontmatter)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkCalloutDirectives)
    .use(remarkObsidianCallouts)
    .use(remarkSupersub)
    .use(remarkDefinitionList)
    .use(remarkGemoji)
    .use(remarkWikilinks, (target) => resolveWikilinkTargetPath(db, target))
    .use(remarkHighlight)

  if (useSmartypants) {
    processor.use(remarkSmartypants)
  }

  const file = await processor
    .use(remarkRehype, {
      handlers: {
        ...defListHastHandlers,
        mark: (h: any, node: any) => h(node, 'mark', node.children),
      }
    })
    .use(rehypeRewriteAttachmentLinks)
    .use(rehypeSanitize, schema)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown)

  return { 
    html: String(file), 
    frontmatter: file.data.frontmatter || null 
  }
}
