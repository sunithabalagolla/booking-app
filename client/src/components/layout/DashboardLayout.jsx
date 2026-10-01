import { Link, NavLink, Outlet } from 'react-router'
import { usePendingOwnerCount } from '../../api/adminOwners.js'
import { useLogout } from '../../api/auth.js'
import { useAuthStore } from '../../store/authStore.js'
import Button from '../ui/Button.jsx'
import ThemeSwitch from '../ui/ThemeSwitch.jsx'
import { dashboardMenuFor } from './navigation.js'
import SkipLink from './SkipLink.jsx'

// Owner and admin layout (UI-30 "box office register"): ink brown sidebar with
// the logo and the role's menu; main area is ruled ledger paper with a red margin.
// Laptop first; on tablets and phones the sidebar becomes a top bar (NF-02).
export default function DashboardLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const menu = dashboardMenuFor(user)
  // A-03: how many owners wait for approval (admin only)
  const pendingOwners = usePendingOwnerCount(user?.role === 'admin').data ?? 0
  const counts = { pendingOwners }

  return (
    <div className="min-h-screen md:flex">
      <SkipLink />
      <aside className="flex flex-wrap items-center gap-3 bg-ink p-4 text-cream md:min-h-screen md:w-60 md:flex-col md:items-stretch">
        <Link to="/" className="font-heading text-3xl text-gold" aria-label="Talkies – Home">
          Talkies
        </Link>
        <nav aria-label="Register menu" className="flex-1">
          <ul className="flex flex-wrap gap-2 md:flex-col">
            {menu.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/owner' || item.to === '/admin'}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center rounded-btn px-3 font-type hover:bg-stage ${isActive ? 'bg-stage text-gold' : ''}`
                  }
                >
                  {item.label}
                  {item.count && counts[item.count] > 0 && (
                    <span className="ml-2 rounded-btn bg-gold px-2 text-sm text-ink" aria-label={`${counts[item.count]} waiting`}>
                      {counts[item.count]}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeSwitch onDark />
          <Button variant="light" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Log out
          </Button>
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="ledger min-h-screen flex-1 p-6 pl-14 focus:outline-none">
        <Outlet />
      </main>
    </div>
  )
}
