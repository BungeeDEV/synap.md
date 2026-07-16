import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'
import type Database from 'better-sqlite3'
// Relative import, not the '#shared' alias - unlike Nitro at runtime,
// plain `vitest run` (this file has a .test.ts) has no alias resolution
// configured, so '#shared/...' fails to resolve under the test runner.
import { formatDate } from '../../shared/formatDate'
import { indexNote } from './indexer'
import { TEMPLATES_DIR } from './specialFolders'
import { resolveVaultPath } from './vault-path'

export interface TemplateInfo {
  name: string
  path: string
}

/**
 * Thrown by createNoteFromTemplate when templateName doesn't match an
 * existing file in _templates/. Deliberately not an h3 createError() here -
 * createError/h3 auto-imports aren't available outside the Nitro runtime,
 * which would break this file's Vitest unit tests. Route handlers translate
 * this to a 404 themselves (see note-from-template.post.ts, daily-note.post.ts).
 */
export class TemplateNotFoundError extends Error {
  constructor(templateName: string) {
    super(`Template "${templateName}" not found`)
    this.name = 'TemplateNotFoundError'
  }
}

/** Relative vault path of a template given its name (filename without extension). */
export function templateRelativePath(templateName: string): string {
  return `${TEMPLATES_DIR}/${templateName}.md`
}

/** Lists templates in _templates/ - flat only, no subfolders per spec. */
export async function listTemplates(vaultRoot: string): Promise<TemplateInfo[]> {
  const templatesDir = resolveVaultPath(TEMPLATES_DIR, vaultRoot)

  let entries
  try {
    entries = await readdir(templatesDir, { withFileTypes: true })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => ({ name: basename(entry.name, extname(entry.name)), path: `${TEMPLATES_DIR}/${entry.name}` }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

interface TemplateVariables {
  title: string
  now: Date
}

/** Replaces {{date}}, {{time}}, {{datetime}} and {{title}} tokens in a template's raw content. */
export function renderTemplate(rawContent: string, variables: TemplateVariables): string {
  const date = formatDate(variables.now, 'YYYY-MM-DD')
  const time = formatDate(variables.now, 'HH:mm')

  return rawContent
    .replaceAll('{{date}}', date)
    .replaceAll('{{time}}', time)
    .replaceAll('{{datetime}}', `${date} ${time}`)
    .replaceAll('{{title}}', variables.title)
}

/**
 * Writes a new note at relativePath, populated from templateName's rendered
 * content (or empty if templateName is null), then indexes it if it's
 * Markdown. Shared by note-from-template.post.ts and daily-note.post.ts so
 * the creation logic isn't duplicated between them.
 */
export async function createNoteFromTemplate(
  db: Database.Database,
  relativePath: string,
  templateName: string | null,
  vaultRoot: string
): Promise<{ path: string, mtime: string }> {
  // resolveVaultPath's VaultPathError is left to propagate as-is (not
  // wrapped) - route handlers already know how to turn a VaultPathError
  // into a 400, same as every other route that calls resolveVaultPath.
  const absolutePath = resolveVaultPath(relativePath, vaultRoot)

  let content = ''
  if (templateName) {
    const templateAbsolutePath = resolveVaultPath(templateRelativePath(templateName), vaultRoot)

    let raw: string
    try {
      raw = await readFile(templateAbsolutePath, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new TemplateNotFoundError(templateName)
      }
      throw err
    }

    const title = basename(relativePath, extname(relativePath))
    content = renderTemplate(raw, { title, now: new Date() })
  }

  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf-8')

  if (relativePath.toLowerCase().endsWith('.md')) {
    await indexNote(db, relativePath, vaultRoot)
  }

  const { mtime } = await stat(absolutePath)
  return { path: relativePath, mtime: mtime.toISOString() }
}
