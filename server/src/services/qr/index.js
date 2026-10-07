import crypto from 'node:crypto'
import QRCode from 'qrcode'

// SEC-09 signed QR tickets (U-17). The QR holds a token, not plain booking data:
//   <booking ID>.<qrNonce>.<signature>
// signature = HMAC-SHA256 of "<booking ID>.<qrNonce>" with QR_SECRET (base64url).
// A new qrNonce (ticket transfer, SF-02) makes the old QR useless.
// verifyQrToken is used by the gate scanner (S-03, Phase 7).

// Read when needed, so tests can set it. The server does not start without it.
export function getQrSecret() {
  const secret = process.env.QR_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('QR_SECRET is missing or shorter than 32 characters. Set it in .env.')
  }
  return secret
}

const sign = (payload) => crypto.createHmac('sha256', getQrSecret()).update(payload).digest('base64url')

export function qrToken(booking) {
  const payload = `${booking._id}.${booking.qrNonce}`
  return `${payload}.${sign(payload)}`
}

// → { bookingId, nonce } when the signature is right, else null.
// The caller still checks that the nonce is the booking's current one.
export function verifyQrToken(token) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 3 || !/^[0-9a-f]{24}$/.test(parts[0]) || !parts[1]) return null
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`))
  const given = Buffer.from(parts[2])
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null
  return { bookingId: parts[0], nonce: parts[1] }
}

// Ink on paper white: enough contrast for any phone camera
const QR_OPTIONS = { errorCorrectionLevel: 'M', margin: 2, width: 320, color: { dark: '#2A1D15', light: '#FFFFFF' } }

export const qrDataUrl = (booking) => QRCode.toDataURL(qrToken(booking), QR_OPTIONS) // ticket page
export const qrPng = (booking) => QRCode.toBuffer(qrToken(booking), { ...QR_OPTIONS, type: 'png' }) // PDF + email
