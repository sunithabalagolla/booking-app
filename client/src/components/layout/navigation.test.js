import { describe, expect, it } from 'vitest'
import { accountLinksFor, dashboardMenuFor, FOOTER_LINKS } from './navigation.js'

const user = { name: 'Asha', role: 'user' }
const owner = { name: 'Ravi', role: 'owner', owner: { approvalStatus: 'approved' } }
const pending = { name: 'New', role: 'owner', owner: { approvalStatus: 'pending' } }
const staff = { name: 'Gate', role: 'staff' }
const admin = { name: 'Admin', role: 'admin' }

describe('accountLinksFor (header)', () => {
  it('shows nothing while the login is being checked', () => {
    expect(accountLinksFor('loading', null)).toEqual({ kind: 'loading' })
  })

  it('shows Log in and Sign up to guests', () => {
    expect(accountLinksFor('guest', null).links.map((l) => l.to)).toEqual(['/login', '/signup'])
  })

  it('shows the name; a user has no extra own-page link', () => {
    expect(accountLinksFor('user', user)).toEqual({ kind: 'user', name: 'Asha', ownPage: null })
  })

  it('links each other role to its own page', () => {
    expect(accountLinksFor('user', owner).ownPage).toEqual({ to: '/owner', label: 'My register' })
    expect(accountLinksFor('user', pending).ownPage).toEqual({ to: '/owner/pending', label: 'My owner account' })
    expect(accountLinksFor('user', admin).ownPage).toEqual({ to: '/admin', label: 'Admin register' })
    expect(accountLinksFor('user', staff).ownPage).toEqual({ to: '/staff/scan', label: 'Gate scanner' })
  })
})

describe('dashboardMenuFor (UI-30 sidebar)', () => {
  it('gives owners and admins their register', () => {
    expect(dashboardMenuFor(owner)).toEqual([{ to: '/owner', label: 'Box office register' }])
    expect(dashboardMenuFor(admin)).toEqual([{ to: '/admin', label: 'Box office register' }])
  })

  it('gives nothing to other roles (they never see the dashboard)', () => {
    for (const person of [user, pending, staff, null]) expect(dashboardMenuFor(person)).toEqual([])
  })
})

describe('FOOTER_LINKS', () => {
  it('has the "For theatre owners" link (O-01)', () => {
    expect(FOOTER_LINKS).toEqual([{ to: '/owner/signup', label: 'For theatre owners' }])
  })
})
