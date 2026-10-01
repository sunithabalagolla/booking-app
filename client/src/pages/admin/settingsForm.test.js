import { describe, expect, it } from 'vitest'
import { ALL_FIELDS, formToChanges, hasTestValues, settingsToForm } from './settingsForm.js'

// Like the API answer (defaults, nothing for commission / GST yet)
const settings = {
  holdMinutes: 10,
  maxSeatsPerBooking: 10,
  convenienceFeePaise: 3000,
  cancelCutoffMinutes: 120,
  userRefundTicketPercent: 75,
  userRefundFoodPercent: 100,
  checkinBeforeMinutes: 30,
  defaultCleaningBreakMinutes: 15,
  commissionPercent: null,
  waitlistOfferMinutes: 10,
  dealStartMinutes: 30,
  dealMaxPercent: 50,
  transferCutoffMinutes: 30,
  accessTokenMinutes: 15,
  refreshTokenDays: 7,
  resetLinkMinutes: 30,
  gst: { ticketPercent: null, foodPercent: null, convenienceFeePercent: null, hsnSac: { ticket: null, food: null, convenienceFee: null } },
  platform: { companyName: null, gstin: null, address: null },
  uploadMaxMb: 2,
  posterMaxWidthPx: 800,
}

describe('settings form (A-05)', () => {
  it('has a form field for every changeable setting (not cities)', () => {
    expect(ALL_FIELDS).toHaveLength(27) // 16 single values + 6 GST + 3 platform company + 2 upload
    expect(ALL_FIELDS.some((f) => f.path === 'cities')).toBe(false)
  })

  it('shows rupees for the fee and empty text for "not set"', () => {
    const form = settingsToForm(settings)
    expect(form.convenienceFeePaise).toBe('30.00')
    expect(form.commissionPercent).toBe('')
    expect(form['gst.hsnSac.ticket']).toBe('')
  })

  it('an unchanged form sends nothing', () => {
    expect(formToChanges(settingsToForm(settings), settings)).toEqual({ body: {}, errors: {} })
  })

  it('sends only what changed, nested, with rupees as paise', () => {
    const form = { ...settingsToForm(settings), holdMinutes: '12', convenienceFeePaise: '30.50', 'gst.ticketPercent': '18', 'gst.hsnSac.food': ' 996331 ' }
    expect(formToChanges(form, settings)).toEqual({
      body: { holdMinutes: 12, convenienceFeePaise: 3050, gst: { ticketPercent: 18, hsnSac: { food: '996331' } } },
      errors: {},
    })
  })

  it('gives messages for wrong number formats and for emptying a saved value', () => {
    const form = { ...settingsToForm(settings), holdMinutes: '10.5', commissionPercent: '12.345', convenienceFeePaise: 'thirty', maxSeatsPerBooking: '' }
    expect(Object.keys(formToChanges(form, settings).errors).sort()).toEqual(['commissionPercent', 'convenienceFeePaise', 'holdMinutes', 'maxSeatsPerBooking'])
  })

  it('spots the seed TEST values', () => {
    expect(hasTestValues(settings)).toBe(false)
    expect(hasTestValues({ ...settings, gst: { hsnSac: { ticket: 'TEST-TICKET' } } })).toBe(true)
    expect(hasTestValues({ ...settings, platform: { companyName: 'Talkies Sample Pvt Ltd (TEST)' } })).toBe(true)
  })
})
