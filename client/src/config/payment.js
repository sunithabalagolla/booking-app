// PAY-02 / PAY-03 mock payment lists. Copy of server/src/config/payment.js
// (payment.test.js checks they match).

// Netbanking test banks: every bank succeeds except "Test Bank (fails)"
export const BANKS = [
  { code: 'sbi_test', name: 'State Bank (test)' },
  { code: 'hdfc_test', name: 'HDFC Bank (test)' },
  { code: 'icici_test', name: 'ICICI Bank (test)' },
  { code: 'canara_test', name: 'Canara Bank (test)' },
  { code: 'fail_test', name: 'Test Bank (fails)' },
]

// UPI success@test = success (anything else fails); card 4111 1111 1111 1111 = success
export const TEST_VALUES = { upiSuccess: 'success@test', cardSuccess: '4111111111111111', failingBank: 'fail_test' }
