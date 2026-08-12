import {realpathSync} from 'node:fs'
import {resolve, sep} from 'node:path'

export class VaultPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultPathError'
  }
}

function assertWithinRoot(candidate: string, root: string): void {
  const rootWithSep = root.endsWith(sep) ? root : root + sep
  if (candidate !== root && !candidate.startsWith(rootWithSep)) {
    throw new VaultPathError('Path escapes the vault root')
  }
}

/**
 * Resolves a client-supplied relative path against the vault root and
 * guarantees the result stays inside it. Throws VaultPathError otherwise.
 */
export function resolveVaultPath(relativePath: string, vaultRoot: string): string {
  if (relativePath.length === 0) {
    throw new VaultPathError('Path must be a non-empty string')
  }

  if (relativePath.includes('\0')) {
    throw new VaultPathError('Path contains a null byte')
  }

  const root = resolve(vaultRoot)
  const resolved = resolve(root, relativePath)
  assertWithinRoot(resolved, root)

  // Defense-in-depth: if the target (or the root itself) already exists,
  // resolve symlinks and re-check, so a symlink planted inside the vault
  // can't be used to read/write outside it. Skipped when the path doesn't
  // exist yet (e.g. a file about to be created).
  try {
    const realResolved = realpathSync(resolved)
    const realRoot = realpathSync(root)
    assertWithinRoot(resolve(realResolved), resolve(realRoot))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  return resolved
}

/**
 * True when a filesystem write failed because the OS rejected the path
 * syntax itself (e.g. reserved characters like `:` `|` `?` on Windows), not
 * because something's missing. Only meaningful right after a `recursive`
 * mkdir/writeFile against an already-resolved path, where ENOENT can no
 * longer mean "a parent directory doesn't exist" - recursive creation
 * already handles that case.
 */
export function isInvalidPathSyntaxError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOENT' || code === 'EINVAL'
}
