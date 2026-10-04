import { homePathFor, roleKey } from '../../store/authStore.js'

// Which links the layouts show. Plain functions, so they are easy to test.

// Footer links. Policy pages (U-28, Phase 11) and "Behind the scenes" (UI-47, Phase 10)
// are added when those pages exist.
export const FOOTER_LINKS = [{ to: '/owner/signup', label: 'For theatre owners' }]

// Link from the public header to a person's own work page
const OWN_PAGE_LABELS = {
  owner: 'My register',
  owner_pending: 'My owner account',
  admin: 'Admin register',
  staff: 'Gate scanner',
}

// Header account area: guests see Log in / Sign up; logged-in people see their
// name, a link to their own page (not for users) and Log out.
export function accountLinksFor(status, user) {
  if (status === 'loading') return { kind: 'loading' }
  if (status !== 'user') {
    return {
      kind: 'guest',
      links: [
        { to: '/login', label: 'Log in' },
        { to: '/signup', label: 'Sign up', button: true }, // gold button (UI-15)
      ],
    }
  }
  const label = OWN_PAGE_LABELS[roleKey(user)]
  return { kind: 'user', name: user.name, ownPage: label ? { to: homePathFor(user), label } : null }
}

// Dashboard sidebar menu (UI-30). More items come with their pages.
export function dashboardMenuFor(user) {
  switch (roleKey(user)) {
    case 'owner':
      return [
        { to: '/owner', label: 'Box office register' },
        { to: '/owner/theatres', label: 'Theatres' }, // O-03 (+ screens O-04, canteen O-07)
        { to: '/owner/shows', label: 'Shows' }, // O-05
      ]
    case 'admin':
      return [
        { to: '/admin', label: 'Box office register' },
        { to: '/admin/owners', label: 'Owners', count: 'pendingOwners' }, // A-03 (count = waiting)
        { to: '/admin/theatres', label: 'Theatres', count: 'pendingTheatres' }, // A-04
        { to: '/admin/movies', label: 'Movies' }, // A-02
        { to: '/admin/settings', label: 'Settings' }, // A-05
      ]
    default:
      return []
  }
}
