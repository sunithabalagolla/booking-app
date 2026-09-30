import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSignup } from '../../api/auth.js'
import Button from '../../components/ui/Button.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors, signupSchema } from '../../validation/auth.js'

// U-01 Sign up: name, email, password. After sign up the user must verify the email.
export default function SignupPage() {
  const navigate = useNavigate()
  const signup = useSignup()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})

  const change = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  function submit(e) {
    e.preventDefault()
    const result = signupSchema.safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    signup.mutate(result.data, {
      onSuccess: (data) => navigate('/check-email', { state: { email: data.email } }),
      // Field errors from the server (same rules) show under the fields
      onError: (error) => setErrors(error.details ?? {}),
    })
  }

  const serverError = signup.error && !signup.error.details ? signup.error : null

  return (
    <PaperCard title="Sign up">
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField label="Name" name="name" autoComplete="name" value={form.name} onChange={change('name')} error={errors.name} />
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
          autoComplete="new-password"
          hint="At least 8 characters, with at least 1 letter and 1 number."
          value={form.password}
          onChange={change('password')}
          error={errors.password}
        />

        {serverError && (
          <p role="alert" className="font-bold text-maroon">
            {serverError.message}
            {serverError.code === 'EMAIL_TAKEN' && (
              <>
                {' '}
                <Link to="/check-email" state={{ email: form.email.trim().toLowerCase() }} className="underline">
                  Resend the verify email
                </Link>
              </>
            )}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={signup.isPending}>
          {signup.isPending ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-maroon underline">
          Log in
        </Link>
      </p>
    </PaperCard>
  )
}
