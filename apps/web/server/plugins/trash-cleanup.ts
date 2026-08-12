const CLEANUP_INTERVAL_MS = 60 * 60 * 1000

export default defineNitroPlugin(async () => {
  // Nitro doesn't guarantee plugin file ordering the way numeric-prefixed
  // middleware does - this can't assume server/plugins/db.ts has already
  // run. initDb() is idempotent (no-ops if already initialized), so calling
  // it here too is the safe way to guarantee getDb() below has a connection.
  await initDb()

  const config = useRuntimeConfig()
  const retentionDays = Number.parseInt(config.trashRetentionDays, 10)
  const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30

  const runCleanup = (): void => {
    cleanupExpiredTrash(getDb(), config.vaultPath, days).catch((err) => {
      console.error('trash-cleanup.ts: cleanup run failed', err)
    })
  }

  runCleanup()
  setInterval(runCleanup, CLEANUP_INTERVAL_MS)
})
