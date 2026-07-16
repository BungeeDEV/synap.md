export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const db = getDb()

  const files = await listMarkdownFiles(config.vaultPath)

  let indexed = 0
  const failed: { path: string, error: string }[] = []

  for (const relativePath of files) {
    try {
      await indexNote(db, relativePath, config.vaultPath)
      indexed++
    } catch (err) {
      failed.push({ path: relativePath, error: (err as Error).message })
    }
  }

  return { total: files.length, indexed, failed }
})
