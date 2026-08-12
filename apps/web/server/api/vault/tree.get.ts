import { readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: TreeNode[]
  mtime?: number
}

async function buildTree(absDir: string, vaultRoot: string): Promise<TreeNode[]> {
  const entries = await readdir(absDir, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.') || SPECIAL_FOLDERS.includes(entry.name as (typeof SPECIAL_FOLDERS)[number])) continue

    const absPath = join(absDir, entry.name)
    const relPath = relative(vaultRoot, absPath).split(sep).join('/')

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'folder',
        children: await buildTree(absPath, vaultRoot)
      })
    } else if (entry.isFile()) {
      const stats = await stat(absPath)
      nodes.push({ name: entry.name, path: relPath, type: 'file', mtime: stats.mtimeMs })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const vaultRoot = resolveVaultPath('.', config.vaultPath)

  try {
    return await buildTree(vaultRoot, vaultRoot)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Vault directory not found' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to read vault tree' })
  }
})
