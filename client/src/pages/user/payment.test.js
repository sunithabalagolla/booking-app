import { describe, expect, it } from 'vitest'
import { atLeast, EMPTY_PAYMENT, formatCardNumber, formatExpiry, gatewayBody, paymentErrors, toPaymentFieldErrors } from './payment.js'

// U-16 payment page helpers (UI-25, PAY-02)
const NOW = new Date(2026, 9, 6) // 6 Oct 2026
const card = { ...EMPTY_PAYMENT, cardNumber: '4111 1111 1111 1111', expiry: '12/28', cvv: '123', name: 'Meena Iyer' }

describe('typing helpers', () => {
  it('card number in groups of 4, digits only, max 16', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111')
    expect(formatCardNumber('4111-1111 11a')).toBe('4111 1111 11')
    expect(formatCardNumber('41111111111111119999')).toBe('4111 1111 1111 1111')
    expect(formatCardNumber('4111')).toBe('4111')
  })

  it('expiry gets its slash', () => {
    expect(formatExpiry('1228')).toBe('12/28')
    expect(formatExpiry('12')).toBe('12')
    expect(formatExpiry('12/2')).toBe('12/2')
  })
})

describe('quick checks', () => {
  it('UPI', () => {
    expect(paymentErrors('upi', { ...EMPTY_PAYMENT, upiId: 'success@test' }, NOW)).toEqual({})
    expect(paymentErrors('upi', { ...EMPTY_PAYMENT, upiId: 'success' }, NOW)).toEqual({ upiId: 'A UPI ID looks like name@bank.' })
  })

  it('card', () => {
    expect(paymentErrors('card', card, NOW)).toEqual({})
    expect(paymentErrors('card', { ...card, cardNumber: '4111', expiry: '13/28', cvv: '12', name: ' ' }, NOW)).toEqual({
      cardNumber: 'A card number has 16 digits.',
      expiry: 'This card has expired.',
      cvv: 'The CVV has 3 digits.',
      name: 'Please type the name on the card.',
    })
    expect(paymentErrors('card', { ...card, expiry: '09/26' }, NOW)).toEqual({ expiry: 'This card has expired.' })
    expect(paymentErrors('card', { ...card, expiry: '10/26' }, NOW)).toEqual({}) // this month is fine
    expect(paymentErrors('card', { ...card, expiry: '1028' }, NOW)).toEqual({ expiry: 'Expiry looks like MM/YY.' })
  })

  it('netbanking', () => {
    expect(paymentErrors('netbanking', EMPTY_PAYMENT, NOW)).toEqual({ bank: 'Please pick a bank.' })
    expect(paymentErrors('netbanking', { ...EMPTY_PAYMENT, bank: 'sbi_test' }, NOW)).toEqual({})
  })
})

describe('gateway body', () => {
  it('only the chosen method', () => {
    expect(gatewayBody('order_1', 'upi', { ...card, upiId: ' success@test ' })).toEqual({ orderId: 'order_1', method: 'upi', upiId: 'success@test' })
    expect(gatewayBody('order_1', 'card', card)).toEqual({ orderId: 'order_1', method: 'card', card: { number: '4111111111111111', expiry: '12/28', cvv: '123', name: 'Meena Iyer' } })
    expect(gatewayBody('order_1', 'netbanking', { ...card, bank: 'hdfc_test' })).toEqual({ orderId: 'order_1', method: 'netbanking', bank: 'hdfc_test' })
  })

  it('server card errors map to the form fields', () => {
    expect(toPaymentFieldErrors({ 'card.number': 'x', 'card.cvv': 'y', upiId: 'z' })).toEqual({ cardNumber: 'x', cvv: 'y', upiId: 'z' })
  })

  it('atLeast waits for both', async () => {
    const start = Date.now()
    expect(await atLeast(Promise.resolve(7), 50)).toBe(7)
    expect(Date.now() - start).toBeGreaterThanOrEqual(45)
  })
})
