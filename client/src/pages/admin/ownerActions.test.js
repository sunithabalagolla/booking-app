import { describe, expect, it } from 'vitest'
import { ownerActions } from './ownerActions.js'

const owner = (approvalStatus, fields = {}) => ({ approvalStatus, emailVerified: true, status: 'active', ...fields })

describe('ownerActions (A-03 buttons)', () => {
  it('pending + verified: approve or reject', () => {
    expect(ownerActions(owner('pending'))).toEqual(['approve', 'reject'])
  })

  it('email not verified: no buttons yet', () => {
    expect(ownerActions(owner('pending', { emailVerified: false }))).toEqual([])
    expect(ownerActions(owner('rejected', { emailVerified: false }))).toEqual([])
  })

  it('rejected: can still be approved, not rejected again', () => {
    expect(ownerActions(owner('rejected'))).toEqual(['approve'])
  })

  it('approved: block, or unblock when blocked; never reject', () => {
    expect(ownerActions(owner('approved'))).toEqual(['block'])
    expect(ownerActions(owner('approved', { status: 'blocked' }))).toEqual(['unblock'])
  })
})
