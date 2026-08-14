import { describe, expect, it } from 'vitest'
import { hashUserPassword, verifyUserPassword } from './password'

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashUserPassword('correct horse battery staple')

    expect(await verifyUserPassword('correct horse battery staple', hash)).toBe(true)
    expect(await verifyUserPassword('wrong password', hash)).toBe(false)
  })

  it('salts hashes so the same password produces different hashes', async () => {
    const a = await hashUserPassword('same-password')
    const b = await hashUserPassword('same-password')

    expect(a).not.toBe(b)
    expect(await verifyUserPassword('same-password', a)).toBe(true)
    expect(await verifyUserPassword('same-password', b)).toBe(true)
  })

  it('rejects malformed stored hashes instead of throwing', async () => {
    expect(await verifyUserPassword('anything', 'not-a-valid-hash')).toBe(false)
  })
})
