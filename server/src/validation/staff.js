import { z } from 'zod'

// S-02 gate scan body (api.md Section 9): the QR token from the camera OR a typed booking
// number (backup). Exactly one of them.
export const checkInSchema = z
  .object({
    qrToken: z.string().trim().min(1).max(200).optional(),
    bookingNumber: z
      .string()
      .max(20, { error: 'A booking number is TK + 8 characters, e.g. TK7F3K9QXM.' })
      .transform((v) => v.replace(/\s+/g, '').toUpperCase())
      .refine((v) => v.length > 0, { error: 'Please type the booking number.' })
      .optional(),
  })
  .refine((body) => Boolean(body.qrToken) !== Boolean(body.bookingNumber), { error: 'Send a QR code or a booking number.', path: ['bookingNumber'] })
