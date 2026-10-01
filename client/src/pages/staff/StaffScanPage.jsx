import { Navigate } from 'react-router'
import { useLogout } from '../../api/auth.js'
import Button from '../../components/ui/Button.jsx'
import { useAuthStore } from '../../store/authStore.js'

// S-01: staff open straight here after login. No intro animation, ever (UI-10).
// The real scanner (S-02 to S-05, UI-31) comes in Phase 7; this is the frame for it.
export default function StaffScanPage() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  if (status === 'loading') return null
  if (status === 'guest') return <Navigate to="/login" replace />
  if (user.role !== 'staff') return <Navigate to="/" replace />

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <p className="text-center font-heading text-3xl text-maroon dark:text-gold">Talkies</p>
      {/* Old ticket window frame (UI-31): wooden border, cream window */}
      <section className="rounded-t-[999px] rounded-b-card border-8 border-wood bg-cream-light px-6 pt-16 pb-6 text-center text-ink">
        <h1 className="mb-4 font-heading text-2xl text-maroon">Gate scanner</h1>
        <p className="font-type">Namaste, {user.name}.</p>
        <p className="mt-2" role="status">
          The scanner comes in Phase 7 (S-02).
        </p>
      </section>
      <Button variant="secondary" className="self-center" onClick={() => logout.mutate()} disabled={logout.isPending}>
        Log out
      </Button>
    </main>
  )
}
