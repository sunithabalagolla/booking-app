import { Outlet } from 'react-router'
import { useLogout } from '../../api/auth.js'
import Button from '../ui/Button.jsx'
import ThemeSwitch from '../ui/ThemeSwitch.jsx'

// Gate Staff layout: no site header or footer, the scanner fills the screen (UI-31).
// Only a small wooden bar with the logo, theme switch (UI-02, all roles) and Log out.
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
      <main id="main" className="flex flex-1 flex-col p-4">
        <Outlet />
      </main>
    </div>
  )
}
