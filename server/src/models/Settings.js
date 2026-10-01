import mongoose from 'mongoose'

// settings collection (database.md 5.4, A-05): ONE document, _id 'platform',
// with every business rule the admin can change. Bookings copy the values they
// use (snapshot), so a change only affects new bookings.
const { Schema } = mongoose

const settingsSchema = new Schema(
  {
    _id: { type: String, default: 'platform' },
    holdMinutes: { type: Number, default: 10 }, // BR-01
    maxSeatsPerBooking: { type: Number, default: 10 }, // BR-02
    convenienceFeePaise: { type: Number, default: 3000 }, // BR-03, per ticket, GST included
    cancelCutoffMinutes: { type: Number, default: 120 }, // BR-04
    userRefundTicketPercent: { type: Number, default: 75 }, // BR-05 (after discount)
    userRefundFoodPercent: { type: Number, default: 100 }, // BR-05
    checkinBeforeMinutes: { type: Number, default: 30 }, // BR-08
    defaultCleaningBreakMinutes: { type: Number, default: 15 }, // BR-09
    commissionPercent: { type: Number, default: null }, // BR-11 (open question: starting value)
    waitlistOfferMinutes: { type: Number, default: 10 }, // BR-13
    dealStartMinutes: { type: Number, default: 30 }, // BR-14
    dealMaxPercent: { type: Number, default: 50 }, // BR-14
    transferCutoffMinutes: { type: Number, default: 30 }, // BR-15
    accessTokenMinutes: { type: Number, default: 15 }, // BR-19
    refreshTokenDays: { type: Number, default: 7 }, // BR-19
    resetLinkMinutes: { type: Number, default: 30 }, // U-03
    gst: {
      // BR-20 (open question: confirm with a CA)
      ticketPercent: { type: Number, default: null },
      foodPercent: { type: Number, default: null },
      convenienceFeePercent: { type: Number, default: null },
      hsnSac: {
        ticket: { type: String, default: null },
        food: { type: String, default: null },
        convenienceFee: { type: String, default: null },
      },
    },
    platform: {
      // 11.3: the platform on the invoice (convenience fee)
      companyName: { type: String, default: null },
      gstin: { type: String, default: null },
      address: { type: String, default: null },
    },
    uploadMaxMb: { type: Number, default: 2 }, // SEC-11
    posterMaxWidthPx: { type: Number, default: 800 }, // NF-08
    // Fixed city list (O-03, U-04). Set by the seed script only; no admin screen.
    cities: [{ _id: false, code: { type: String, required: true }, name: { type: String, required: true }, state: { type: String, required: true } }],
  },
  { timestamps: true, minimize: false },
)

export const Settings = mongoose.model('Settings', settingsSchema)

// The settings document. Made with the defaults if it does not exist yet,
// so the app works before the seed has run.
export async function getSettings() {
  const found = await Settings.findById('platform')
  if (found) return found
  try {
    return await Settings.create({ _id: 'platform' })
  } catch (error) {
    if (error.code === 11000) return Settings.findById('platform') // made at the same moment by another request
    throw error
  }
}
