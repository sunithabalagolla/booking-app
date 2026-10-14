import { NavLink, Outlet } from 'react-router'
import { useLogout } from '../../api/auth.js'
import Button from '../ui/Button.jsx'
import ThemeSwitch from '../ui/ThemeSwitch.jsx'
import { STAFF_TABS } from './navigation.js'

// Gate Staff layout: no site header or footer, the scanner fills the screen (UI-31).
// Only a small wooden bar with the logo, theme switch (UI-02, all roles) and Log out,
// and two tabs: Gate scanner | Canteen counter (O-11).

export default function StaffLayout() {
  const logout = useLogout()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 bg-wood px-4 py-2 text-cream">
        <p className="font-heading text-2xl text-gold">Talkies</p>
        <div className="flex items-center gap-3">
          <ThemeSwitch onDark />
          <Button variant="light" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Log out
          </Button>
        </div>
      </header>
      <nav aria-label="Staff pages" className="bg-wood px-4 pb-2">
        <ul className="flex gap-2">
          {STAFF_TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) => `flex min-h-11 items-center rounded-btn px-3 font-type text-cream hover:bg-stage ${isActive ? 'bg-stage text-gold' : ''}`}
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" className="flex flex-1 flex-col p-4">
        <Outlet />
      </main>
    </div>
  )
}
