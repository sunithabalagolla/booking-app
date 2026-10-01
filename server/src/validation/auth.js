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

const nameField = z
  .string({ error: 'Please enter your name.' })
  .trim()
  .min(1, { error: 'Please enter your name.' })
  .max(80, { error: 'Name can have at most 80 characters.' })

export const signupSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
})

// O-01: Indian mobile number. 10 digits starting with 6-9, optional +91 in front.
// Saved as the 10 digits only.
export const phoneField = z
  .string({ error: 'Please enter your mobile number.' })
  .trim()
  .regex(/^(\+91)?[6-9][0-9]{9}$/, { error: 'Please enter a 10 digit mobile number starting with 6, 7, 8 or 9.' })
  .transform((value) => value.slice(-10))

export const ownerSignupSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  businessName: z
    .string({ error: 'Please enter your business name.' })
    .trim()
    .min(1, { error: 'Please enter your business name.' })
    .max(120, { error: 'Business name can have at most 120 characters.' }),
  password: passwordField,
})

export const verifyEmailSchema = z.object({
  token: z.string({ error: 'The link is not complete.' }).min(10, { error: 'The link is not complete.' }).max(200),
})

export const resendVerifySchema = z.object({
  email: emailField,
})

// U-03 forgot / reset password
export const forgotPasswordSchema = z.object({
  email: emailField,
})

export const resetPasswordSchema = z.object({
  token: z.string({ error: 'The link is not complete.' }).min(10, { error: 'The link is not complete.' }).max(200),
  password: passwordField,
})

// Login: no password rules here, only "not empty" (the password is checked against the hash)
export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: 'Please enter your password.' })
    .min(1, { error: 'Please enter your password.' })
    .max(200, { error: 'The email or password is not correct.' }),
})
