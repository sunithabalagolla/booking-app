import crypto from 'node:crypto'
import { TEST_VALUES } from '../../config/payment.js'

// PAY-01 mock payment service: the same functions a real Razorpay service needs
// (createOrder, verifySignature, refund), plus `pay`, which plays the part of the
// Razorpay checkout page. Swapping to Razorpay later changes only this folder.
// IDs look like Razorpay's (order_…, pay_…, rfnd_…). Nothing here touches the database.

// Signing key, like the Razorpay key secret. Read when needed, so tests can set it.
export function getPaymentSecret() {
  const secret = process.env.PAYMENT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('PAYMENT_SECRET is missing or shorter than 32 characters. Set it in .env.')
  }
  return secret
}

const newId = (prefix) => `${prefix}_${crypto.randomBytes(9).toString('base64url')}`

// Razorpay signs "orderId|paymentId" with HMAC-SHA256 and the key secret
const sign = (orderId, paymentId) => crypto.createHmac('sha256', getPaymentSecret()).update(`${orderId}|${paymentId}`).digest('hex')

export async function createOrder({ amountPaise }) {
  return { orderId: newId('order'), amountPaise }
}

// The fake checkout page. details: { upiId } · { card: { number } } · { bank }.
// Returns { ok: true, paymentId, signature } or { ok: false, reason }.
export async function pay({ orderId, method, upiId, card, bank }) {
  const ok =
    (method === 'upi' && upiId?.toLowerCase() === TEST_VALUES.upiSuccess) ||
    (method === 'card' && card?.number === TEST_VALUES.cardSuccess) ||
    (method === 'netbanking' && Boolean(bank) && bank !== TEST_VALUES.failingBank)
  if (!ok) return { ok: false, reason: 'declined' }
  const paymentId = newId('pay')
  return { ok: true, paymentId, signature: sign(orderId, paymentId) }
}

// The check the backend must do before trusting a payment (T-04)
export function verifySignature({ orderId, paymentId, signature }) {
  const expected = Buffer.from(sign(orderId, paymentId), 'hex')
  const given = Buffer.from(String(signature ?? ''), 'hex')
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
}

// Money back (full or part). A real gateway would call its refund API here.
export async function refund({ paymentId, amountPaise }) {
  return { refundId: newId('rfnd'), paymentId, amountPaise }
}
