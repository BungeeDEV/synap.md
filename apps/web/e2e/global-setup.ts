import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Wipe the throwaway vault + index before every run so the first-run setup
// flow (no admin exists yet) is deterministic. The dir is recreated lazily
// by the server on first write.
export default async function globalSetup() {
  const tmpDir = fileURLToPath(new URL('./.tmp', import.meta.url))
  await rm(tmpDir, { recursive: true, force: true })
}
