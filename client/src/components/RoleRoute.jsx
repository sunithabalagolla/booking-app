import { Navigate, useLocation } from 'react-router'
import { roleRedirect, useAuthStore } from '../store/authStore.js'

// Page guard (ROLE-01 on the client). `allow` = who may open the page:
// 'guest', 'user', 'owner' (approved), 'owner_pending' (pending / rejected), 'staff', 'admin'.
// Guests go to login; a wrong role goes quietly to its own home (homePathFor).
// The server checks again on every API call; this only keeps people on their own pages.
export default function RoleRoute({ allow, children }) {
  const location = useLocation()
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)

  const target = roleRedirect({ status, user }, allow)
  if (target === undefined) return null // still checking the login
  if (target === '/login') return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (target) return <Navigate to={target} replace />
  return children
}
