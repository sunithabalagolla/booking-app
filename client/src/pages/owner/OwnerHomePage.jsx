import DashboardPlaceholder from '../../components/ui/DashboardPlaceholder.jsx'
import { useAuthStore } from '../../store/authStore.js'

// Approved owners open here after login. The real dashboard is O-02 (Phase 8).
export default function OwnerHomePage() {
  const businessName = useAuthStore((s) => s.user?.owner?.businessName)
  return <DashboardPlaceholder subtitle={businessName} />
}
