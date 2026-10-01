import { useAuthStore } from '../../store/authStore.js'

// Placeholder content for the owner and admin home pages until the dashboards are
// built (O-02, A-01 in Phase 8). The ledger paper and sidebar come from DashboardLayout.
export default function DashboardPlaceholder({ subtitle }) {
  const user = useAuthStore((s) => s.user)

  return (
    <>
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">Box office register</h1>
      <p className="mt-2 font-type">{subtitle}</p>
      <p className="mt-8" role="status">
        Namaste, {user?.name}. Box office register – comes in Phase 8.
      </p>
    </>
  )
}
