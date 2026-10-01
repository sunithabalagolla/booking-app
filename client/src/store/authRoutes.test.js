import { describe, expect, it } from 'vitest'
import { fieldErrors, ownerSignupSchema } from '../validation/auth.js'
import { homePathFor, needsApproval } from './authStore.js'

const good = { name: 'Ravi', email: 'ravi@example.com', phone: '9876543210', businessName: 'Ravi Talkies', password: 'matinee123' }

// O-01 phone rule: 10 digits starting 6-9, optional +91, sent as 10 digits
describe('ownerSignupSchema phone', () => {
  it('keeps 10 digits and removes +91', () => {
    expect(ownerSignupSchema.parse(good).phone).toBe('9876543210')
    expect(ownerSignupSchema.parse({ ...good, phone: ' +916123456789 ' }).phone).toBe('6123456789')
  })

  it('refuses wrong numbers', () => {
    for (const phone of ['5876543210', '987654321', '98765432100', '+91 98765 43210', '']) {
      const result = ownerSignupSchema.safeParse({ ...good, phone })
      expect(fieldErrors(result.error).phone).toBe('Please enter a 10 digit mobile number starting with 6, 7, 8 or 9.')
    }
  })
})

describe('needsApproval (O-01)', () => {
  it('is true only for owners that are not approved', () => {
    expect(needsApproval({ role: 'owner', owner: { approvalStatus: 'pending' } })).toBe(true)
    expect(needsApproval({ role: 'owner', owner: { approvalStatus: 'rejected' } })).toBe(true)
    expect(needsApproval({ role: 'owner', owner: { approvalStatus: 'approved' } })).toBe(false)
    expect(needsApproval({ role: 'user' })).toBe(false)
    expect(needsApproval(null)).toBe(false)
  })
})

describe('homePathFor (S-01, O-01)', () => {
  it('sends staff to the scanner, even when they came from another page', () => {
    expect(homePathFor({ role: 'staff' }, '/movies/1')).toBe('/staff/scan')
  })

  it('sends a pending owner to the waiting page', () => {
    expect(homePathFor({ role: 'owner', owner: { approvalStatus: 'pending' } }, '/x')).toBe('/owner/pending')
  })

  it('sends everyone else back to where they came from', () => {
    expect(homePathFor({ role: 'user' }, '/movies/1')).toBe('/movies/1')
    expect(homePathFor({ role: 'owner', owner: { approvalStatus: 'approved' } })).toBe('/')
  })
})
