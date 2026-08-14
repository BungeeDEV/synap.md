import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveVaultPath, VaultPathError } from './vault-path'

describe('resolveVaultPath', () => {
  let vaultRoot: string

  beforeAll(() => {
    vaultRoot = mkdtempSync(join(tmpdir(), 'vault-test-'))
    mkdirSync(join(vaultRoot, 'notes'))
    writeFileSync(join(vaultRoot, 'notes', 'a.md'), '# a')
  })

  afterAll(() => {
    rmSync(vaultRoot, { recursive: true, force: true })
  })

  it('resolves a simple relative path inside the vault', () => {
    expect(resolveVaultPath('notes/a.md', vaultRoot)).toBe(join(vaultRoot, 'notes', 'a.md'))
  })

  it('resolves the vault root itself', () => {
    expect(resolveVaultPath('.', vaultRoot)).toBe(resolve(vaultRoot))
  })

  it('rejects classic path traversal', () => {
    expect(() => resolveVaultPath('../../../etc/passwd', vaultRoot)).toThrow(VaultPathError)
  })

  it('rejects traversal hidden in the middle of a path', () => {
    expect(() => resolveVaultPath('notes/../../../etc/passwd', vaultRoot)).toThrow(VaultPathError)
  })

  it('rejects absolute paths outside the vault', () => {
    const outside = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc/passwd'
    expect(() => resolveVaultPath(outside, vaultRoot)).toThrow(VaultPathError)
  })

  it('rejects null bytes', () => {
    expect(() => resolveVaultPath('notes/a.md\0.txt', vaultRoot)).toThrow(VaultPathError)
  })

  it('rejects empty paths', () => {
    expect(() => resolveVaultPath('', vaultRoot)).toThrow(VaultPathError)
  })

  it('fails closed on non-string paths, like an unvalidated array query param would', () => {
    // Callers (server/api/vault/*) type-guard with `typeof === 'string'` before
    // ever reaching this function, so this only throws a generic TypeError
    // rather than VaultPathError - but it still throws before touching the
    // filesystem, which is the property that actually matters here.
    // @ts-expect-error deliberately passing a wrong type
    expect(() => resolveVaultPath(['notes/a.md'], vaultRoot)).toThrow()
  })

  it.skipIf(process.platform === 'win32')('rejects symlinks that escape the vault', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'vault-outside-'))
    writeFileSync(join(outsideDir, 'secret.txt'), 'nope')
    symlinkSync(outsideDir, join(vaultRoot, 'escape-link'), 'dir')

    expect(() => resolveVaultPath('escape-link/secret.txt', vaultRoot)).toThrow(VaultPathError)

    rmSync(outsideDir, { recursive: true, force: true })
  })
})
