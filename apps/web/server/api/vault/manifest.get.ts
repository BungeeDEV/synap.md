export default defineEventHandler(async (event) => {
  const db = getDb()

  const rows = db.prepare('SELECT path, hash, mtime, size FROM notes').all() as {
    path: string
    hash: string | null
    mtime: number
    size: number | null
  }[]

  return { files: rows }
})
