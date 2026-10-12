import { z } from 'zod'
import { emailField, passwordField } from './auth.js'

// O-09 Gate Staff form. Same rules as the server (server/src/validation/staffAccounts.js).

const nameField = z.string().trim().min(1, { error: 'Please enter the name.' }).max(80, { error: 'Name can have at most 80 characters.' })
const theatreIdsField = z.array(z.string()).min(1, { error: 'Please pick at least one theatre.' })

export const newStaffSchema = z.object({ name: nameField, email: emailField, password: passwordField, theatreIds: theatreIdsField })

// Edit: the email stays; an empty "New password" box = keep the old password
export const editStaffSchema = z.object({
  name: nameField,
  password: z.union([z.literal(''), passwordField]),
  theatreIds: theatreIdsField,
})

export const EMPTY_STAFF = { name: '', email: '', password: '', theatreIds: [] }

export function staffToForm(staff) {
  return { name: staff.name, email: staff.email, password: '', theatreIds: staff.theatres.map((t) => t.id) }
}

// Only what the server needs: no email on edit, no empty password
export function formToBody({ name, email, password, theatreIds }, { isNew }) {
  if (isNew) return { name, email, password, theatreIds }
  return { name, theatreIds, ...(password ? { password } : {}) }
}

export const STAFF_STATUS_LABELS = { active: 'Active', blocked: 'Blocked' }
export const STAFF_STATUS_TONES = { active: 'green', blocked: 'maroon' }

// The confirm question under the row (block / unblock)
export function blockQuestion(staff) {
  return staff.status === 'blocked'
    ? { title: `Unblock ${staff.name}?`, text: 'They can log in and scan tickets again.', button: 'Yes, unblock' }
    : { title: `Block ${staff.name}?`, text: 'They are logged out at once and cannot scan tickets.', button: 'Yes, block' }
}
