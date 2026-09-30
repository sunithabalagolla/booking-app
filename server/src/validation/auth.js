import { z } from 'zod'

// Zod schemas for /api/auth (SEC-06). The client has the same password rule
// in client/src/validation/auth.js – keep them the same.

export const emailField = z
  .string({ error: 'Please enter your email.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Please enter a valid email.' }))

// BR-18: at least 8 characters, at least 1 letter and 1 number.
// Max 72 because bcrypt only uses the first 72 bytes.
export const passwordField = z
  .string({ error: 'Please enter a password.' })
  .min(8, { error: 'Password must have at least 8 characters.' })
  .max(72, { error: 'Password can have at most 72 characters.' })
  .regex(/[A-Za-z]/, { error: 'Password must have at least 1 letter.' })
  .regex(/[0-9]/, { error: 'Password must have at least 1 number.' })

export const signupSchema = z.object({
  name: z
    .string({ error: 'Please enter your name.' })
    .trim()
    .min(1, { error: 'Please enter your name.' })
    .max(80, { error: 'Name can have at most 80 characters.' }),
  email: emailField,
  password: passwordField,
})

export const verifyEmailSchema = z.object({
  token: z.string({ error: 'The link is not complete.' }).min(10, { error: 'The link is not complete.' }).max(200),
})

export const resendVerifySchema = z.object({
  email: emailField,
})

// Login: no password rules here, only "not empty" (the password is checked against the hash)
export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: 'Please enter your password.' })
    .min(1, { error: 'Please enter your password.' })
    .max(200, { error: 'The email or password is not correct.' }),
})
