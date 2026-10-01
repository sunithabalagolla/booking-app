import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useResetPassword } from '../../api/auth.js'
import Button from '../../components/ui/Button.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors, resetPasswordSchema } from '../../validation/auth.js'

const buttonLink = 'inline-block min-h-11 rounded-btn bg-maroon px-5 py-2 font-type text-cream'

// U-03: the link in the reset email opens this page: /reset-password?token=...
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const reset = useResetPassword()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})

  const change = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  function submit(e) {
    e.preventDefault()
    const result = resetPasswordSchema.safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    reset.mutate({ token, password: result.data.password }, { onError: (error) => setErrors(error.details ?? {}) })
  }

  // No token, or the server says the link is expired / used / replaced
  if (!token || reset.error?.code === 'RULE_BROKEN') {
    return (
      <PaperCard title="This link does not work">
        <div className="space-y-4">
          <p role="alert">
            The link has expired (it works for 30 minutes), was already used, or was replaced by a newer one.
          </p>
          <Link to="/forgot-password" className={buttonLink}>
            Get a new link
          </Link>
        </div>
      </PaperCard>
    )
  }

  if (reset.isSuccess) {
    return (
      <PaperCard title="Password changed">
        <div className="space-y-4">
          <p role="status">{reset.data.message}</p>
          <p>For safety, you are logged out on all devices.</p>
          <Link to="/login" className={buttonLink}>
            Log in
          </Link>
        </div>
      </PaperCard>
    )
  }

  const error = reset.error && !reset.error.details ? reset.error : null

  return (
    <PaperCard title="Choose a new password">
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with at least 1 letter and 1 number."
          value={form.password}
          onChange={change('password')}
          error={errors.password}
        />
        <TextField
          label="New password again"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={change('confirm')}
          error={errors.confirm}
        />

        {error && (
          <p role="alert" className="font-bold text-maroon">
            {error.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </PaperCard>
  )
}
