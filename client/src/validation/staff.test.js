import { describe, expect, it } from 'vitest'
import { blockQuestion, editStaffSchema, formToBody, newStaffSchema, staffToForm } from './staff.js'

// O-09 Gate Staff form helpers

const staff = { id: 's1', name: 'Raju', email: 'raju@example.com', status: 'active', theatres: [{ id: 't1', name: 'Chandni Talkies' }] }

describe('staff form', () => {
  it('new staff needs name, email, a BR-18 password and at least one theatre', () => {
    const ok = newStaffSchema.safeParse({ name: ' Raju ', email: 'Raju@Example.com', password: 'gatepass9', theatreIds: ['t1'] })
    expect(ok.data).toEqual({ name: 'Raju', email: 'raju@example.com', password: 'gatepass9', theatreIds: ['t1'] })
    const bad = newStaffSchema.safeParse({ name: '', email: 'x', password: 'short', theatreIds: [] })
    expect([...new Set(bad.error.issues.map((i) => i.path[0]))].sort()).toEqual(['email', 'name', 'password', 'theatreIds'])
  })

  it('edit: empty new password is fine; a weak one is not', () => {
    expect(editStaffSchema.safeParse({ ...staffToForm(staff) }).success).toBe(true)
    expect(editStaffSchema.safeParse({ ...staffToForm(staff), password: 'abc' }).success).toBe(false)
  })

  it('sends only what the server needs', () => {
    const form = { ...staffToForm(staff), password: '' }
    expect(formToBody(form, { isNew: false })).toEqual({ name: 'Raju', theatreIds: ['t1'] })
    expect(formToBody({ ...form, password: 'newgate77' }, { isNew: false })).toEqual({ name: 'Raju', theatreIds: ['t1'], password: 'newgate77' })
    expect(formToBody({ ...form, password: 'gatepass9' }, { isNew: true })).toEqual({ name: 'Raju', email: 'raju@example.com', password: 'gatepass9', theatreIds: ['t1'] })
  })

  it('asks the right block / unblock question', () => {
    expect(blockQuestion(staff)).toMatchObject({ title: 'Block Raju?', button: 'Yes, block' })
    expect(blockQuestion({ ...staff, status: 'blocked' })).toMatchObject({ title: 'Unblock Raju?', button: 'Yes, unblock' })
  })
})
