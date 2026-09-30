import { useState } from 'react'
import { useResendVerify } from '../../api/auth.js'
import { emailField } from '../../validation/auth.js'
import Button from './Button.jsx'
import TextField from './TextField.jsx'

// U-01 "Resend verify email" (max 3 per hour, the server checks).
// If we already know the email, only the button is shown.
export default function ResendVerify({ knownEmail }) {
  const resend = useResendVerify()
  const [email, setEmail] = useState(knownEmail ?? '')
  const [error, setError] = useState()

  function submit(e) {
    e.preventDefault()
    const result = emailField.safeParse(email)
    if (!result.success) {
      setError('Please enter a valid email.')
      return
    }
    setError(undefined)
    resend.mutate(result.data)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {!knownEmail && (
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
      )}
      <Button type="submit" variant="secondary" disabled={resend.isPending}>
        {resend.isPending ? 'Sending…' : 'Resend the verify email'}
      </Button>
      {/* role="status" so screen readers hear the result */}
      <p role="status" className="text-sm">
        {resend.isSuccess && 'Done. If the account is not verified yet, a new link is on its way. The old link no longer works.'}
        {resend.isError && <span className="font-bold text-maroon">{resend.error.message}</span>}
      </p>
    </form>
  )
}
