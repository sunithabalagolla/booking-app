import { z } from 'zod'

// Same rules as the server (server/src/validation/auth.js) – keep them the same.
// The server checks again; this is only so the user sees mistakes at once.

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Please enter a valid email.' }))

// BR-18: at least 8 characters, at least 1 letter and 1 number
export const passwordField = z
  .string()
  .min(8, { error: 'Password must have at least 8 characters.' })
  .max(72, { error: 'Password can have at most 72 characters.' })
  .regex(/[A-Za-z]/, { error: 'Password must have at least 1 letter.' })
  .regex(/[0-9]/, { error: 'Password must have at least 1 number.' })

export const signupSchema = z.object({
  name: z.string().trim().min(1, { error: 'Please enter your name.' }).max(80, { error: 'Name can have at most 80 characters.' }),
  email: emailField,
  password: passwordField,
})

// Login: only "not empty" for the password (it is checked on the server)
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, { error: 'Please enter your password.' }),
})

// Zod result → { field: 'first message' }
export function fieldErrors(zodError) {
  const errors = {}
  for (const issue of zodError.issues) {
    errors[issue.path.join('.')] ??= issue.message
  }
  return errors
}
