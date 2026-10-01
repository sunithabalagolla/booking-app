import { describe, expect, it } from 'vitest'
import { fieldErrors, resetPasswordSchema } from './auth.js'

// U-03: new password form
describe('resetPasswordSchema', () => {
  it('accepts a good password typed twice the same', () => {
    expect(resetPasswordSchema.safeParse({ password: 'secondshow42', confirm: 'secondshow42' }).success).toBe(true)
  })

  it('refuses two different passwords, with the message on the confirm field', () => {
    const result = resetPasswordSchema.safeParse({ password: 'secondshow42', confirm: 'secondshow43' })
    expect(result.success).toBe(false)
    expect(fieldErrors(result.error)).toEqual({ confirm: 'The two passwords are not the same.' })
  })

  it('refuses a password that breaks BR-18', () => {
    const result = resetPasswordSchema.safeParse({ password: 'onlyletters', confirm: 'onlyletters' })
    expect(fieldErrors(result.error).password).toBe('Password must have at least 1 number.')
  })
})
