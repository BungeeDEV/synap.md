import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'

let db: Database.Database | null = null
let initPromise: Promise<Database.Database> | null = null
let initError: Error | null = null

/** Returns the already-initialized DB connection. Throws if initDb() hasn't run yet. */
export function getDb(): Database.Database {
  if (!db) {
    if (initError) {
      throw new Error(`Database not initialized - initDb() failed: ${initError.message}. See earlier log output for the full stack trace.`)
    }
    throw new Error('Database not initialized - initDb() must run before getDb() is called')
  }
  return db
}

/**
 * Opens the DB (creating the data directory if needed) and applies pending
 * migrations. Idempotent - safe to call from multiple Nitro plugins, which
 * Nitro may run concurrently rather than strictly sequentially. Caching the
 * in-flight promise (not just the resolved `db`) matters: without it, two
 * concurrent callers would both pass the `if (db)` check before either
 * finished migrating, and both would run runMigrations() against the same
 * fresh file, racing to apply the same ALTER TABLE and failing with
 * "duplicate column name".
 */
export async function initDb(): Promise<Database.Database> {
  if (db) return db
  if (!initPromise) {
    initPromise = (async () => {
      const config = useRuntimeConfig()
      mkdirSync(dirname(config.dataPath), { recursive: true })

      const instance = new Database(config.dataPath)
      instance.pragma('journal_mode = WAL')
      instance.pragma('foreign_keys = ON')

      try {
        await runMigrations(instance)
      } catch (err) {
        instance.close()
        initError = err instanceof Error ? err : new Error(String(err))
        console.error('Database migration failed:', initError.stack ?? initError.message)
        throw initError
      }

      db = instance
      return instance
    })()
  }
  return initPromise
}

async function runMigrations(instance: Database.Database): Promise<void> {
  const storage = useStorage('assets:migrations')
  const keys = [...(await storage.getKeys())].sort()
  const currentVersion = instance.pragma('user_version', { simple: true }) as number

  for (const key of keys) {
    const fileName = key.split(':').pop() ?? key
    const version = Number.parseInt(fileName, 10)
    if (!Number.isFinite(version) || version <= currentVersion) continue

    const sql = await storage.getItem<string>(key)
    if (!sql) continue

    const applyMigration = instance.transaction(() => {
      instance.exec(sql)
      instance.pragma(`user_version = ${version}`)
    })
    applyMigration()
  }
}
