import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useLogin } from '../../api/auth.js'
import Button from '../../components/ui/Button.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import ResendVerify from '../../components/ui/ResendVerify.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { needsApproval, useAuthStore } from '../../store/authStore.js'
import { fieldErrors, loginSchema } from '../../validation/auth.js'

// U-02 Login: email + password. Same page for all 4 roles (S-01).
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const sessionExpired = useAuthStore((s) => s.sessionExpired)
  const login = useLogin()
  const [form, setForm] = useState({ email: location.state?.email ?? '', password: '' })
  const [errors, setErrors] = useState({})

  // Go back to the page the user came from, or Home
  const from = location.state?.from ?? '/'

  // Where to go after login: a pending / rejected owner waits on /owner/pending (O-01)
  const target = (u) => (needsApproval(u) ? '/owner/pending' : from)

  if (status === 'user' && !login.isSuccess) return <Navigate to={target(user)} replace />

  const change = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  function submit(e) {
    e.preventDefault()
    const result = loginSchema.safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    login.mutate(result.data, {
      onSuccess: (data) => navigate(target(data.user), { replace: true }),
      onError: (error) => setErrors(error.details ?? {}),
    })
  }

  const error = login.error && !login.error.details ? login.error : null

  return (
    <PaperCard title="Log in">
      <form onSubmit={submit} noValidate className="space-y-4">
        {sessionExpired && !error && (
          <p role="status" className="rounded-btn border border-ink p-3">
            Interval over! Please log in again to continue the show.
          </p>
        )}

        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={change('email')}
          error={errors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={change('password')}
          error={errors.password}
        />

        {error && (
          <p role="alert" className="font-bold text-maroon">
            {error.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      {/* Correct password, but the email is not verified yet: offer a new link */}
      {error?.code === 'EMAIL_NOT_VERIFIED' && (
        <div className="mt-4">
          <ResendVerify knownEmail={form.email.trim().toLowerCase()} />
        </div>
      )}

      {/* U-03: take the typed email along, so the user does not type it again */}
      <p className="mt-6 text-sm">
        <Link
          to="/forgot-password"
          state={{ email: form.email.trim().toLowerCase() }}
          className="font-bold text-maroon underline"
        >
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-sm">
        New here?{' '}
        <Link to="/signup" className="font-bold text-maroon underline">
          Sign up
        </Link>
      </p>
    </PaperCard>
  )
}
