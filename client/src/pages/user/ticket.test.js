import { describe, expect, it } from 'vitest'
import { invoiceFileName, ticketFileName, ticketInfo } from './ticket.js'

// U-17 / UI-27 paper ticket text
const booking = {
  bookingNumber: 'TK7F3K9QXM',
  show: { movieTitle: 'Kadal Kaatru', certificate: 'UA', language: 'Tamil', format: '2D', label: 'second', startAt: '2026-10-07T16:15:00.000Z' },
  seats: [
    { seatId: 'H10', seatClass: 'second' },
    { seatId: 'H2', seatClass: 'second' },
    { seatId: 'A1', seatClass: 'balcony' },
  ],
  food: [
    { name: 'Butter Popcorn', qty: 2 },
    { name: 'Tea', qty: 1 },
  ],
  foodPickup: 'interval',
  pricing: { totalPaise: 104050 },
}

describe('ticketInfo', () => {
  it('admit count, IST show time, classes in order, seats sorted, food + pickup, total', () => {
    expect(ticketInfo(booking)).toEqual({
      admit: 3,
      movieInfo: 'UA · Tamil · 2D',
      showText: 'Wed 7 Oct · Second show · 9:45 PM',
      classText: 'Balcony, Second class',
      seatLabel: 'Seats',
      seatsText: 'A1, H2, H10',
      foodText: '2 × Butter Popcorn, 1 × Tea',
      pickup: 'Food pickup: Interval',
      totalText: '₹1,040.50',
    })
  })

  it('one seat, no food', () => {
    const t = ticketInfo({ ...booking, seats: [{ seatId: 'B4', seatClass: 'first' }], food: [], foodPickup: null, pricing: { totalPaise: 21000 } })
    expect(t).toMatchObject({ admit: 1, classText: 'First class', seatLabel: 'Seat', seatsText: 'B4', foodText: null, pickup: null, totalText: '₹210' })
  })
})

it('download file names', () => {
  expect(ticketFileName(booking)).toBe('Talkies-ticket-TK7F3K9QXM.pdf')
  expect(invoiceFileName(booking)).toBe('Talkies-invoice-TK7F3K9QXM.pdf')
})
