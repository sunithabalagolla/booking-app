import { useLogout } from '../../api/auth.js'
import { useAuthStore } from '../../store/authStore.js'
import Button from './Button.jsx'

// Placeholder for the owner and admin home pages until the dashboards are built
// (O-02, A-01 in Phase 8). Ruled ledger paper with a red margin line (UI-30).
export default function DashboardPlaceholder({ subtitle }) {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-4">
      <section
        className="rounded-card border border-ink bg-cream p-6 pl-12 text-ink"
        style={{
          // Thin blue-grey lines every 32 px + red margin line on the left (UI-30)
          backgroundImage:
            'linear-gradient(to right, transparent 32px, #B23A3A 32px, #B23A3A 34px, transparent 34px), repeating-linear-gradient(to bottom, transparent 0 31px, #9FB3C8 31px 32px)',
        }}
      >
        <h1 className="font-heading text-3xl text-maroon">Box office register</h1>
        <p className="mt-2 font-type">{subtitle}</p>
        <p className="mt-6" role="status">
          Namaste, {user?.name}. Box office register – comes in Phase 8.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Log out
        </Button>
      </section>
    </main>
  )
}
