import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useForgotPassword } from '../../api/auth.js'
import Button from '../../components/ui/Button.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors, forgotPasswordSchema } from '../../validation/auth.js'

// U-03: ask for a password reset link (E-02). Same page for all 4 roles.
export default function ForgotPasswordPage() {
  const location = useLocation()
  const forgot = useForgotPassword()
  const [email, setEmail] = useState(location.state?.email ?? '')
  const [errors, setErrors] = useState({})

  function submit(e) {
    e.preventDefault()
    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    forgot.mutate(result.data.email, { onError: (error) => setErrors(error.details ?? {}) })
  }

  if (forgot.isSuccess) {
    return (
      <PaperCard title="Check your email">
        <div className="space-y-4">
          <p role="status">{forgot.data.message}</p>
          <p>The link works for 30 minutes. Cannot find it? Look in the spam folder too.</p>
          <Link to="/login" className="inline-block font-bold text-maroon underline">
            Back to log in
          </Link>
        </div>
      </PaperCard>
    )
  }

  const error = forgot.error && !forgot.error.details ? forgot.error : null

  return (
    <PaperCard title="Forgot password">
      <form onSubmit={submit} noValidate className="space-y-4">
        <p>Enter your email. We will send you a link to choose a new password.</p>
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        {error && (
          <p role="alert" className="font-bold text-maroon">
            {error.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={forgot.isPending}>
          {forgot.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-6 text-sm">
        <Link to="/login" className="font-bold text-maroon underline">
          Back to log in
        </Link>
      </p>
    </PaperCard>
  )
}
