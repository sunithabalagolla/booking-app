import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useOwnerSignup } from '../../api/auth.js'
import Button from '../../components/ui/Button.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors, ownerSignupSchema } from '../../validation/auth.js'

// O-01 Register as owner. Verify email first (like U-01), then Pending until an admin approves.
export default function OwnerSignupPage() {
  const navigate = useNavigate()
  const signup = useOwnerSignup()
  const [form, setForm] = useState({ name: '', email: '', phone: '', businessName: '', password: '' })
  const [errors, setErrors] = useState({})

  const change = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  function submit(e) {
    e.preventDefault()
    const result = ownerSignupSchema.safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    signup.mutate(result.data, {
      onSuccess: (data) => navigate('/check-email', { state: { email: data.email, owner: true } }),
      onError: (error) => setErrors(error.details ?? {}),
    })
  }

  const serverError = signup.error && !signup.error.details ? signup.error : null

  return (
    <PaperCard title="Register as a theatre owner">
      <form onSubmit={submit} noValidate className="space-y-4">
        <p>For theatre owners. After you verify your email, an admin checks your account before you can add theatres.</p>
        <TextField label="Your name" name="name" autoComplete="name" value={form.name} onChange={change('name')} error={errors.name} />
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
          label="Mobile number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="10 digits, for example 9876543210. +91 in front is fine."
          value={form.phone}
          onChange={change('phone')}
          error={errors.phone}
        />
        <TextField
          label="Business name"
          name="businessName"
          autoComplete="organization"
          value={form.businessName}
          onChange={change('businessName')}
          error={errors.businessName}
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
                <Link to="/check-email" state={{ email: form.email.trim().toLowerCase(), owner: true }} className="underline">
                  Resend the verify email
                </Link>
              </>
            )}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={signup.isPending}>
          {signup.isPending ? 'Creating your account…' : 'Register'}
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
