import { Link, Outlet } from 'react-router'
import { useLogout } from '../../api/auth.js'
import { useAuthStore } from '../../store/authStore.js'
import ThemeSwitch from '../ui/ThemeSwitch.jsx'
import { accountLinksFor, FOOTER_LINKS } from './navigation.js'
import SkipLink from './SkipLink.jsx'

// Public layout (UI-15): header, page, footer. Mobile first (360 px, NF-02).
// Later: ticker strip on top (UI-26, Phase 10), city picker (U-04, Phase 3),
// sound icon (UI-40, Phase 10), bottom navigation (when Ticket album + Profile exist).

const linkClass = 'inline-flex min-h-11 items-center font-bold text-maroon underline dark:text-gold'

function AccountArea() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const account = accountLinksFor(status, user)

  if (account.kind === 'loading') return null

  if (account.kind === 'guest') {
    return (
      <ul className="flex items-center gap-4 font-type">
        {account.links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className={linkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 font-type">
      <span className="max-w-40 truncate" title={account.name}>
        {account.name}
      </span>
      {account.ownPage && (
        <Link to={account.ownPage.to} className={linkClass}>
          {account.ownPage.label}
        </Link>
      )}
      <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className={linkClass}>
        Log out
      </button>
    </div>
  )
}

export default function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="border-b border-ink dark:border-cream-light">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <Link to="/" className="font-heading text-3xl text-maroon dark:text-gold" aria-label="Talkies – Home">
            Talkies
          </Link>
          <div className="flex items-center gap-4">
            <AccountArea />
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 focus:outline-none">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-6">
        <div className="tear-line mb-4 dark:border-cream-light" />
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-between gap-4 font-type">
          <ul className="flex flex-wrap gap-4">
            {FOOTER_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm">© Talkies</p>
        </nav>
      </footer>
    </div>
  )
}
