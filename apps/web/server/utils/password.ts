// Deliberately shadows nuxt-auth-utils' own auto-imported hashUserPassword/
// verifyUserPassword (backed by @adonisjs/hash) with a direct node:crypto scrypt
// implementation - no extra native dependency, and no indirection through a
// third-party hashing abstraction. Nuxt logs a "duplicated import" warning
// for this at build time; that's expected, it's confirming this file wins.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// A hand-rolled promise wrapper instead of util.promisify(scryptCallback):
// promisify picks crypto.scrypt's 3-arg (no options) overload, so the
// 4-arg (with options) call below wouldn't typecheck through it.
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

// Cost parameters are stored alongside each hash (not hardcoded at verify
// time) so they can be bumped later without invalidating existing hashes.
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 64

export async function hashUserPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })

  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('hex')}:${derivedKey.toString('hex')}`
}

export async function verifyUserPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts
  const N = Number.parseInt(nRaw!, 10)
  const r = Number.parseInt(rRaw!, 10)
  const p = Number.parseInt(pRaw!, 10)
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false

  const salt = Buffer.from(saltHex!, 'hex')
  const expected = Buffer.from(hashHex!, 'hex')
  if (salt.length === 0 || expected.length === 0) return false

  const derivedKey = await scrypt(password, salt, expected.length, { N, r, p })

  return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected)
}

let dummyHash: Promise<string> | null = null

/**
 * A precomputed, valid-format hash for an unguessable dummy password. Login
 * runs verifyUserPassword() against this when the username doesn't exist, so an
 * unknown-username request takes the same scrypt-computation time as a
 * wrong-password one instead of returning early and leaking timing info.
 */
export function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = hashUserPassword('dummy-password-for-constant-time-login-checks')
  }
  return dummyHash
}
