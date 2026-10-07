// PAY-02 / PAY-03 mock payment lists (our own test values, not real gateway values).
// The client has a copy (client/src/config/payment.js); a client test checks they match.

// Netbanking test banks (decided 2026-10-06): every bank succeeds except "Test Bank (fails)"
export const BANKS = [
  { code: 'sbi_test', name: 'State Bank (test)' },
  { code: 'hdfc_test', name: 'HDFC Bank (test)' },
  { code: 'icici_test', name: 'ICICI Bank (test)' },
  { code: 'canara_test', name: 'Canara Bank (test)' },
  { code: 'fail_test', name: 'Test Bank (fails)' },
]

// UPI success@test = success (anything else fails); card 4111 1111 1111 1111 = success
export const TEST_VALUES = { upiSuccess: 'success@test', cardSuccess: '4111111111111111', failingBank: 'fail_test' }

// JOB-02 payment safety check (every 5 minutes)
// - a payment captured at the gateway but not verified is settled after this grace time
//   (a normal verify call is still on its way during it) (decided 2026-10-07)
export const VERIFY_GRACE_MINUTES = 2
// - an order never paid is failed after max(this, the seat hold time), so nobody still
//   inside a longer hold loses seats (decided 2026-10-07)
export const STUCK_ORDER_MINUTES = 15
