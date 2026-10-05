import { randomBytes, randomInt } from 'node:crypto'

// S-02 booking number: 'TK' + 8 characters that are easy to read and type at the gate
// (A–Z and 2–9 without 0, O, 1, I), e.g. TK7F3K9QXM. Unique index in bookings.
export const BOOKING_NUMBER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newBookingNumber() {
  let text = 'TK'
  for (let i = 0; i < 8; i++) text += BOOKING_NUMBER_CHARS[randomInt(BOOKING_NUMBER_CHARS.length)]
  return text
}

// SEC-09: random part of the QR token (the QR itself comes with U-17)
export const newQrNonce = () => randomBytes(16).toString('hex')
