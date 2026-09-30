import { Link } from 'react-router'
import { useLogout } from '../../api/auth.js'
import { useAuthStore } from '../../store/authStore.js'

// Small "Logged in as … · Log out" line (U-02).
// It moves into the real header in the "basic vintage layout" task.
export default function AuthStatus() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  if (status === 'loading') return null

  if (status === 'user') {
    return (
      <p className="font-type">
        Logged in as <strong>{user.name}</strong> ·{' '}
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="min-h-11 font-bold text-maroon underline dark:text-gold"
        >
          Log out
        </button>
      </p>
    )
  }

  return (
    <p className="font-type">
      <Link to="/login" className="font-bold text-maroon underline dark:text-gold">
        Log in
      </Link>{' '}
      ·{' '}
      <Link to="/signup" className="font-bold text-maroon underline dark:text-gold">
        Sign up
      </Link>
    </p>
  )
}
