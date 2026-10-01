import { describe, expect, it } from 'vitest'
import { fieldErrors, ownerSignupSchema } from '../validation/auth.js'
import { homePathFor, needsApproval, PUBLIC, roleRedirect } from './authStore.js'

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

  it('sends approved owners and admins to their register, always', () => {
    expect(homePathFor({ role: 'owner', owner: { approvalStatus: 'approved' } }, '/movies/1')).toBe('/owner')
    expect(homePathFor({ role: 'admin' }, '/movies/1')).toBe('/admin')
  })

  it('sends a user back to where they came from', () => {
    expect(homePathFor({ role: 'user' }, '/movies/1')).toBe('/movies/1')
    expect(homePathFor({ role: 'user' })).toBe('/')
  })
})

// ROLE-01 on the client (RoleRoute)
describe('roleRedirect', () => {
  const as = (user) => ({ status: 'user', user })
  const staff = { role: 'staff' }
  const user = { role: 'user' }
  const owner = { role: 'owner', owner: { approvalStatus: 'approved' } }
  const pending = { role: 'owner', owner: { approvalStatus: 'pending' } }
  const admin = { role: 'admin' }

  it('waits while the login is being checked', () => {
    expect(roleRedirect({ status: 'loading' }, ['admin'])).toBeUndefined()
  })

  it('sends guests to login, except on public pages', () => {
    expect(roleRedirect({ status: 'guest' }, ['admin'])).toBe('/login')
    expect(roleRedirect({ status: 'guest' }, PUBLIC)).toBeNull()
  })

  it('lets the right role in', () => {
    expect(roleRedirect(as(admin), ['admin'])).toBeNull()
    expect(roleRedirect(as(staff), ['staff'])).toBeNull()
    expect(roleRedirect(as(pending), ['owner_pending'])).toBeNull()
  })

  it('sends a wrong role quietly to its own home', () => {
    expect(roleRedirect(as(user), ['admin'])).toBe('/')
    expect(roleRedirect(as(owner), ['staff'])).toBe('/owner')
    expect(roleRedirect(as(pending), ['owner'])).toBe('/owner/pending')
    expect(roleRedirect(as(owner), ['owner_pending'])).toBe('/owner')
    expect(roleRedirect(as(admin), ['owner'])).toBe('/admin')
  })

  it('sends staff from public pages back to the scanner; others may browse', () => {
    expect(roleRedirect(as(staff), PUBLIC)).toBe('/staff/scan')
    for (const person of [user, owner, pending, admin]) expect(roleRedirect(as(person), PUBLIC)).toBeNull()
  })

  it('never loops: every home page lets its own person in', () => {
    const allowOf = { '/': PUBLIC, '/owner': ['owner'], '/owner/pending': ['owner_pending'], '/staff/scan': ['staff'], '/admin': ['admin'] }
    for (const person of [user, owner, pending, staff, admin]) {
      expect(roleRedirect(as(person), allowOf[homePathFor(person)])).toBeNull()
    }
  })
})
