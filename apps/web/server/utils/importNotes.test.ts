import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeImportedContent, resolveImportTargetPath } from './importNotes'

describe('normalizeImportedContent', () => {
  it('decodes plain UTF-8 content as-is', () => {
    const result = normalizeImportedContent(Buffer.from('# Hello\n\nWorld', 'utf-8'))
    expect(result).toEqual({ content: '# Hello\n\nWorld' })
  })

  it('strips a leading UTF-8 BOM', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('# Title', 'utf-8')])
    const result = normalizeImportedContent(withBom)
    expect(result).toEqual({ content: '# Title' })
  })

  it('normalizes CRLF and lone CR line endings to LF', () => {
    const result = normalizeImportedContent(Buffer.from('line1\r\nline2\rline3\n', 'utf-8'))
    expect(result).toEqual({ content: 'line1\nline2\nline3\n' })
  })

  it('rejects content containing a NUL byte as non-text', () => {
    const result = normalizeImportedContent(Buffer.from([0x48, 0x69, 0x00, 0x21]))
    expect(result).toEqual({ error: expect.any(String) })
  })
})

describe('resolveImportTargetPath', () => {
  let vaultRoot: string

  beforeEach(() => {
    vaultRoot = mkdtempSync(join(tmpdir(), 'vault-import-'))
  })

  afterEach(() => {
    rmSync(vaultRoot, { recursive: true, force: true })
  })

  it('returns the plain candidate path when nothing exists yet', async () => {
    const result = await resolveImportTargetPath(vaultRoot, '', 'Note', 'skip')
    expect(result).toEqual({ path: 'Note.md' })
  })

  it('places the file under the given target folder', async () => {
    const result = await resolveImportTargetPath(vaultRoot, 'Projects', 'Note', 'skip')
    expect(result).toEqual({ path: 'Projects/Note.md' })
  })

  it('skip: reports skipped when the target already exists', async () => {
    writeFileSync(join(vaultRoot, 'Note.md'), 'existing')
    const result = await resolveImportTargetPath(vaultRoot, '', 'Note', 'skip')
    expect(result).toEqual({ skipped: true })
  })

  it('replace: reuses the existing path unchanged', async () => {
    writeFileSync(join(vaultRoot, 'Note.md'), 'existing')
    const result = await resolveImportTargetPath(vaultRoot, '', 'Note', 'replace')
    expect(result).toEqual({ path: 'Note.md' })
  })

  it('keep-both: suffixes with (2) when the plain name is taken', async () => {
    writeFileSync(join(vaultRoot, 'Note.md'), 'existing')
    const result = await resolveImportTargetPath(vaultRoot, '', 'Note', 'keep-both')
    expect(result).toEqual({ path: 'Note (2).md' })
  })

  it('keep-both: keeps counting up past an already-taken suffix', async () => {
    writeFileSync(join(vaultRoot, 'Note.md'), 'existing')
    writeFileSync(join(vaultRoot, 'Note (2).md'), 'existing')
    const result = await resolveImportTargetPath(vaultRoot, '', 'Note', 'keep-both')
    expect(result).toEqual({ path: 'Note (3).md' })
  })
})
