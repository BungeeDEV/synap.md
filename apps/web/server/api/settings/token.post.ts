import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  
  const body = await readBody<{ name: string }>(event)
  if (!body?.name || typeof body.name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const db = getDb()
  const createdAt = new Date().toISOString()
  
  // Insert with a temporary random hash to get the ID, because token_hash is UNIQUE NOT NULL
  const tempHash = 'temp_' + randomBytes(16).toString('hex')
  const stmt = db.prepare('INSERT INTO api_tokens (token_hash, name, created_at) VALUES (?, ?, ?)')
  const info = stmt.run(tempHash, body.name, createdAt)
  const id = info.lastInsertRowid

  const secret = randomBytes(32).toString('base64url')
  const rawToken = `synap_v1_${id}_${secret}`
  const tokenHash = await hashUserPassword(secret)
  
  db.prepare('UPDATE api_tokens SET token_hash = ? WHERE id = ?').run(tokenHash, id)
  
  // Return the raw token ONLY ONCE. The client must save it.
  return { token: rawToken, name: body.name, createdAt }
})
