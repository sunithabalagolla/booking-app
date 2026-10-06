import { z } from 'zod'
import { BANKS } from '../config/payment.js'

// U-16 mock payment bodies (api.md Section 6). Only IDs and the test values: never amounts (SEC-10).

const id = (prefix, label) => z.string({ error: `Please send the ${label}.` }).regex(new RegExp(`^${prefix}_[A-Za-z0-9_-]{6,40}$`), { error: `Not a valid ${label}.` })

// MM/YY, this month or later
function expiryOk(text) {
  const [mm, yy] = text.split('/').map(Number)
  if (!(mm >= 1 && mm <= 12)) return false
  const now = new Date()
  const year = 2000 + yy
  return year > now.getUTCFullYear() || (year === now.getUTCFullYear() && mm >= now.getUTCMonth() + 1)
}

// The fake checkout page (PAY-02): one of three methods. Card data is checked, never stored.
export const gatewayPayBody = z.discriminatedUnion(
  'method',
  [
    z.object({
      orderId: id('order', 'order'),
      method: z.literal('upi'),
      upiId: z
        .string({ error: 'Please type your UPI ID.' })
        .trim()
        .max(60)
        .regex(/^[\w.-]{2,}@[A-Za-z]{2,}$/, { error: 'A UPI ID looks like name@bank.' }),
    }),
    z.object({
      orderId: id('order', 'order'),
      method: z.literal('card'),
      card: z.object({
        number: z
          .string({ error: 'Please type the card number.' })
          .transform((n) => n.replace(/[\s-]/g, ''))
          .refine((n) => /^\d{16}$/.test(n), { error: 'A card number has 16 digits.' }),
        expiry: z
          .string({ error: 'Please type the expiry.' })
          .trim()
          .regex(/^\d{2}\/\d{2}$/, { error: 'Expiry looks like MM/YY.' })
          .refine(expiryOk, { error: 'This card has expired.' }),
        cvv: z.string({ error: 'Please type the CVV.' }).trim().regex(/^\d{3}$/, { error: 'The CVV has 3 digits.' }),
        name: z.string({ error: 'Please type the name on the card.' }).trim().min(2, { error: 'Please type the name on the card.' }).max(60),
      }),
    }),
    z.object({
      orderId: id('order', 'order'),
      method: z.literal('netbanking'),
      bank: z.enum(
        BANKS.map((b) => b.code),
        { error: 'Please pick a bank.' },
      ),
    }),
  ],
  { error: 'Please pick UPI, Card or Netbanking.' },
)

export const verifyBody = z.object({
  orderId: id('order', 'order'),
  paymentId: id('pay', 'payment'),
  signature: z.string({ error: 'Please send the signature.' }).regex(/^[0-9a-f]{64}$/, { error: 'Not a valid signature.' }),
})
