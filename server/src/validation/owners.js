import { z } from 'zod'
import { pageQuery } from './common.js'

// A-03 owner approvals + owner block / unblock (api.md Section 10)

export const listOwnersQuery = z.object({
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  q: z.string().trim().max(100).optional(),
  ...pageQuery,
})

export const rejectOwnerSchema = z.object({
  reason: z
    .string({ error: 'Please give a reason.' })
    .trim()
    .min(5, { error: 'Please give a reason (at least 5 characters).' })
    .max(500, { error: 'The reason can have at most 500 characters.' }),
})

// Block / unblock: the reason is optional; it goes to the audit log
export const blockSchema = z.object({
  reason: z.string().trim().max(500, { error: 'The reason can have at most 500 characters.' }).optional(),
})
