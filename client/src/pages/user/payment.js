// U-16 payment page (UI-25, PAY-02) helpers. Plain functions, so they are easy to test.
// The server checks everything again; these only help the user type and give quick errors.

export const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'netbanking', label: 'Netbanking' },
]

export const EMPTY_PAYMENT = { upiId: '', cardNumber: '', expiry: '', cvv: '', name: '', bank: '' }

// "4111111111111111" → "4111 1111 1111 1111" while typing (digits only, max 16)
export const formatCardNumber = (text) =>
  text
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ')

// "1228" → "12/28" while typing
export function formatExpiry(text) {
  const digits = text.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

// MM/YY, this month or later
function expiryOk(text, now) {
  if (!/^\d{2}\/\d{2}$/.test(text)) return false
  const [mm, yy] = text.split('/').map(Number)
  if (mm < 1 || mm > 12) return false
  const year = 2000 + yy
  return year > now.getFullYear() || (year === now.getFullYear() && mm >= now.getMonth() + 1)
}

// Quick checks before paying → { field: message } (empty = fine)
export function paymentErrors(method, form, now = new Date()) {
  const errors = {}
  if (method === 'upi' && !/^[\w.-]{2,}@[A-Za-z]{2,}$/.test(form.upiId.trim())) errors.upiId = 'A UPI ID looks like name@bank.'
  if (method === 'card') {
    if (form.cardNumber.replace(/\D/g, '').length !== 16) errors.cardNumber = 'A card number has 16 digits.'
    if (!/^\d{2}\/\d{2}$/.test(form.expiry)) errors.expiry = 'Expiry looks like MM/YY.'
    else if (!expiryOk(form.expiry, now)) errors.expiry = 'This card has expired.'
    if (!/^\d{3}$/.test(form.cvv)) errors.cvv = 'The CVV has 3 digits.'
    if (form.name.trim().length < 2) errors.name = 'Please type the name on the card.'
  }
  if (method === 'netbanking' && !form.bank) errors.bank = 'Please pick a bank.'
  return errors
}

// Form → body of POST /api/mock-gateway/pay (only the chosen method's fields)
export function gatewayBody(orderId, method, form) {
  if (method === 'upi') return { orderId, method, upiId: form.upiId.trim() }
  if (method === 'card') return { orderId, method, card: { number: form.cardNumber.replace(/\D/g, ''), expiry: form.expiry, cvv: form.cvv, name: form.name.trim() } }
  return { orderId, method, bank: form.bank }
}

// Server field errors (card.number …) → form fields
export function toPaymentFieldErrors(details = {}) {
  const names = { 'card.number': 'cardNumber', 'card.expiry': 'expiry', 'card.cvv': 'cvv', 'card.name': 'name' }
  return Object.fromEntries(Object.entries(details).map(([key, message]) => [names[key] ?? key, message]))
}

// Wait at least `ms` (UI-25: "Processing…" shows the film reel for 2–3 seconds)
export const atLeast = (promise, ms) => Promise.all([promise, new Promise((resolve) => setTimeout(resolve, ms))]).then(([value]) => value)
