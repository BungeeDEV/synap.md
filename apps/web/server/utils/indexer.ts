import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join, relative, sep } from 'node:path'
import type Database from 'better-sqlite3'
import matter from 'gray-matter'
import type { Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { WikilinkNodeData } from './markdown/remark-wikilinks'
import { remarkWikilinks } from './markdown/remark-wikilinks'
import { resolveWikilinkTargetPath } from './markdown/resolve-wikilink-target'
import { SPECIAL_FOLDERS } from './specialFolders'
import { resolveVaultPath } from './vault-path'

// Requires a leading letter so it doesn't match ATX heading markers ("# Title")
// or numeric ids ("#123").
const TAG_PATTERN = /#([a-zA-Z][\w-]*(?:\/[a-zA-Z][\w-]*)*)/g

interface ExtractedWikilink {
  raw: string
  path: string | null
}

interface ExtractedContent {
  plainText: string
  tags: string[]
  wikilinks: ExtractedWikilink[]
}

function extractContent(db: Database.Database, markdown: string): ExtractedContent {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkWikilinks, (target) => resolveWikilinkTargetPath(db, target))
  // unified's chained .use() overloads don't preserve the specific mdast Root
  // type across 3+ plugins (a known TS ergonomics gap in the unified type
  // system) - asserted here since remark-parse always produces a Root and no
  // plugin in this chain changes the root node type.
  const tree = processor.runSync(processor.parse(markdown)) as Root

  const tags = new Set<string>()
  const wikilinks: ExtractedWikilink[] = []
  const textParts: string[] = []

  // mdast represents code/inline-code as their own node types with a `value`
  // property, never as `text` nodes - so visiting only `text` nodes already
  // excludes tags written inside code blocks. This also naturally picks up
  // wikilink display text for plainText, since it visits descendants too -
  // remarkWikilinks nests it inside a `link`/`span` node, but it's still a
  // `text` node underneath.
  visit(tree, 'text', (node) => {
    const value = 'value' in node && typeof node.value === 'string' ? node.value : ''
    if (!value) return

    textParts.push(value)

    for (const match of value.matchAll(TAG_PATTERN)) {
      tags.add(match[1]!)
    }
  })

  visit(tree, 'link', (node) => {
    const data = 'data' in node ? node.data as WikilinkNodeData | undefined : undefined
    if (!data?.wikilinkRaw) return
    wikilinks.push({ raw: data.wikilinkRaw, path: data.hProperties['data-wikilink-path'] ?? null })
  })

  return { plainText: textParts.join(' '), tags: [...tags], wikilinks }
}

function upsertNote(
  db: Database.Database,
  path: string,
  title: string,
  frontmatter: Record<string, unknown>,
  mtimeMs: number,
  indexedAt: number,
  hash: string,
  size: number
): number {
  const row = db.prepare(`
    INSERT INTO notes (path, title, frontmatter_json, mtime, indexed_at, hash, size)
    VALUES (@path, @title, @frontmatterJson, @mtime, @indexedAt, @hash, @size)
    ON CONFLICT(path) DO UPDATE SET
      title = excluded.title,
      frontmatter_json = excluded.frontmatter_json,
      mtime = excluded.mtime,
      indexed_at = excluded.indexed_at,
      hash = excluded.hash,
      size = excluded.size
    RETURNING id
  `).get({
    path,
    title,
    frontmatterJson: JSON.stringify(frontmatter),
    mtime: Math.trunc(mtimeMs),
    indexedAt,
    hash,
    size
  }) as { id: number }

  return row.id
}

function syncTags(db: Database.Database, noteId: number, tagNames: string[]): void {
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)

  const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING')
  const findTag = db.prepare('SELECT id FROM tags WHERE name = ?')
  const linkTag = db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)')

  for (const name of tagNames) {
    insertTag.run(name)
    const tag = findTag.get(name) as { id: number }
    linkTag.run(noteId, tag.id)
  }
}

function syncLinks(db: Database.Database, noteId: number, wikilinks: ExtractedWikilink[]): void {
  db.prepare('DELETE FROM links WHERE source_note_id = ?').run(noteId)

  const insertLink = db.prepare('INSERT INTO links (source_note_id, target_note_id, target_raw) VALUES (?, ?, ?)')
  const findIdByPath = db.prepare('SELECT id FROM notes WHERE path = ?')

  for (const link of wikilinks) {
    const targetId = link.path ? (findIdByPath.get(link.path) as { id: number } | undefined)?.id ?? null : null
    insertLink.run(noteId, targetId, link.raw)
  }
}

function removeFtsEntry(db: Database.Database, noteId: number): void {
  db.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(noteId)
}

function syncFts(db: Database.Database, noteId: number, title: string, content: string): void {
  removeFtsEntry(db, noteId)
  db.prepare('INSERT INTO notes_fts (rowid, title, content) VALUES (?, ?, ?)').run(noteId, title, content)
}

/** Reads a note from disk, extracts tags/wikilinks/plain text, and upserts it into the index. */
export async function indexNote(db: Database.Database, relativePath: string, vaultRoot: string): Promise<void> {
  const absolutePath = resolveVaultPath(relativePath, vaultRoot)
  const [raw, stats] = await Promise.all([readFile(absolutePath, 'utf-8'), stat(absolutePath)])

  const { data: frontmatter, content } = matter(raw)
  const title = typeof frontmatter.title === 'string' && frontmatter.title.length > 0
    ? frontmatter.title
    : basename(relativePath, extname(relativePath))

  const { plainText, tags, wikilinks } = extractContent(db, content)
  const indexedAt = Date.now()
  const hash = createHash('sha256').update(raw).digest('hex')

  const apply = db.transaction(() => {
    const noteId = upsertNote(db, relativePath, title, frontmatter, stats.mtimeMs, indexedAt, hash, stats.size)
    syncTags(db, noteId, tags)
    syncLinks(db, noteId, wikilinks)
    syncFts(db, noteId, title, plainText)
  })

  apply()
}

/**
 * Updates a note's path (and title, if it was filename-derived) after a
 * rename/move, without a full content reindex - tags/links/plain-text don't
 * change just because the file moved. No-op if the note wasn't indexed.
 */
export async function renameNoteInIndex(
  db: Database.Database,
  oldPath: string,
  newPath: string,
  vaultRoot: string
): Promise<void> {
  const note = db.prepare('SELECT id FROM notes WHERE path = ?').get(oldPath) as { id: number } | undefined
  if (!note) return

  const absolutePath = resolveVaultPath(newPath, vaultRoot)
  const raw = await readFile(absolutePath, 'utf-8')
  const { data: frontmatter } = matter(raw)
  const title = typeof frontmatter.title === 'string' && frontmatter.title.length > 0
    ? frontmatter.title
    : basename(newPath, extname(newPath))

  const apply = db.transaction(() => {
    db.prepare('UPDATE notes SET path = ?, title = ? WHERE id = ?').run(newPath, title, note.id)
    db.prepare('UPDATE notes_fts SET title = ? WHERE rowid = ?').run(title, note.id)
  })

  apply()
}

/** Removes a note and all of its derived data (tags/links/FTS entry) from the index. */
export function removeNoteFromIndex(db: Database.Database, relativePath: string): void {
  const remove = db.transaction(() => {
    const note = db.prepare('SELECT id FROM notes WHERE path = ?').get(relativePath) as { id: number } | undefined
    if (!note) return

    removeFtsEntry(db, note.id)
    // note_tags and links are removed via ON DELETE CASCADE
    db.prepare('DELETE FROM notes WHERE id = ?').run(note.id)
  })

  remove()
}

/** Recursively lists all Markdown file paths in the vault, relative to its root. */
export async function listMarkdownFiles(vaultRoot: string): Promise<string[]> {
  async function walk(absDir: string): Promise<string[]> {
    const entries = await readdir(absDir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || SPECIAL_FOLDERS.includes(entry.name as (typeof SPECIAL_FOLDERS)[number])) continue
      const absPath = join(absDir, entry.name)

      if (entry.isDirectory()) {
        files.push(...await walk(absPath))
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(relative(vaultRoot, absPath).split(sep).join('/'))
      }
    }

    return files
  }

  return walk(vaultRoot)
}
