import { Link, Outlet } from 'react-router'
import { useLogout } from '../../api/auth.js'
import { useAuthStore } from '../../store/authStore.js'
import ButtonLink from '../ui/ButtonLink.jsx'
import CityPicker from '../ui/CityPicker.jsx'
import ThemeSwitch from '../ui/ThemeSwitch.jsx'
import { useDropdown } from '../ui/useDropdown.js'
import HeaderSearch from './HeaderSearch.jsx'
import { accountLinksFor, FOOTER_LINKS } from './navigation.js'
import Pelmet from './Pelmet.jsx'
import SideCurtains from './SideCurtains.jsx'
import SkipLink from './SkipLink.jsx'

// Public layout, "Stage" design (UI-15, docs/home-design.md Sections 1, 2, 7):
// spotlight glow, velvet pelmet, side curtains, film grain (UI-45), content ~1120 px.
// Header on one line (laptops): logo · city · search · account · theme.
// Phones / tablets (below 1024 px): logo · city · ☰ menu (account + theme inside);
// the search box on its own line under the header.
// Later: sound icon (UI-40, Phase 10), bottom navigation (when Ticket album + Profile exist).

const linkClass = 'inline-flex min-h-11 items-center font-bold text-maroon underline dark:text-gold'

// `vertical`: inside the phone menu (one item per line)
function AccountArea({ vertical = false }) {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const account = accountLinksFor(status, user)
  const layout = vertical ? 'flex flex-col items-start gap-1' : 'flex items-center gap-4'

  if (account.kind === 'loading') return null

  if (account.kind === 'guest') {
    return (
      <ul className={`${layout} font-type`}>
        {account.links.map((link) => (
          <li key={link.to}>
            {link.button ? (
              <ButtonLink to={link.to} variant="gold">
                {link.label}
              </ButtonLink>
            ) : (
              <Link to={link.to} className={linkClass}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className={`${layout} min-w-0 font-type`}>
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

// Phones: ☰ opens a small panel with the account links and the theme switch
function PhoneMenu() {
  const { open, toggle, close, wrapperRef, buttonRef, menuId } = useDropdown()

  return (
    <div ref={wrapperRef} className="relative ml-auto lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
        className="flex h-11 w-11 items-center justify-center rounded-btn border border-ink text-2xl text-ink dark:border-gold dark:text-gold"
      >
        <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <div
          id={menuId}
          // A tap on a link closes the menu (the layout stays on screen when the page changes)
          onClick={(event) => event.target.closest('a') && close()}
          className="absolute right-0 z-50 mt-2 w-64 space-y-3 rounded-card border border-ink bg-cream-light p-4 text-ink dark:border-gold dark:bg-ink dark:text-cream"
        >
          <AccountArea vertical />
          <div className="flex items-center gap-3 border-t border-dotted border-ink pt-3 dark:border-gold">
            <ThemeSwitch />
            <span className="font-type text-sm">Theme</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SiteLayout() {
  return (
    <div className="stage-glow flex min-h-screen flex-col">
      <SkipLink />
      <SideCurtains />
      <div aria-hidden="true" className="film-grain" />
      <Pelmet />

      <header>
        <div className="mx-auto flex max-w-[70rem] items-center gap-2 px-4 pt-3 pb-2 sm:gap-3 lg:gap-5">
          <Link to="/" className="shrink-0 font-heading text-2xl text-maroon sm:text-4xl dark:text-gold" aria-label="Talkies – Home">
            Talkies
          </Link>
          <CityPicker />
          <div className="hidden max-w-[26rem] flex-1 lg:block">
            <HeaderSearch id="header-search" />
          </div>
          <div className="ml-auto hidden items-center gap-4 lg:flex">
            <AccountArea />
            <ThemeSwitch />
          </div>
          <PhoneMenu />
        </div>
        <div className="px-4 pb-2 lg:hidden">
          <HeaderSearch id="header-search-phone" />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[70rem] flex-1 px-4 focus:outline-none">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-[70rem] px-4 pb-6">
        <div className="mb-4 border-t-2 border-dotted border-gold" />
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
