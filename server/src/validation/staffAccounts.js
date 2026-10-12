import mongoose from 'mongoose'
import { z } from 'zod'
import { emailField, passwordField } from './auth.js'

// O-09 Gate Staff account fields (api.md Section 8)

const nameField = z
  .string({ error: 'Please enter the name.' })
  .trim()
  .min(1, { error: 'Please enter the name.' })
  .max(80, { error: 'Name can have at most 80 characters.' })

// One or more of the owner's theatres (ROLE-05); "mine" is checked in the controller
const theatreIdsField = z
  .array(z.string().refine((id) => mongoose.isValidObjectId(id), { error: 'Not a valid theatre.' }), { error: 'Please pick at least one theatre.' })
  .min(1, { error: 'Please pick at least one theatre.' })
  .max(50)
  .transform((ids) => [...new Set(ids)])

export const createStaffSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  theatreIds: theatreIdsField,
})

// password = optional new password (decided 2026-10-12: also logs the staff out everywhere)
export const updateStaffSchema = z
  .object({
    name: nameField,
    theatreIds: theatreIdsField,
    status: z.enum(['active', 'blocked'], { error: 'Status must be active or blocked.' }),
    password: passwordField,
  })
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), { error: 'Nothing to change.' })
