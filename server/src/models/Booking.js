import mongoose from 'mongoose'
import { SEAT_CLASSES } from '../utils/seatLayout.js'

// bookings collection (database.md 5.11). U-12 (Phase 4) makes `pending` bookings
// (seats held) and releases them; U-13 food, U-14 full pricing, U-15 coupon. Payment,
// coupon use, QR, check-in, cancel and transfer fields come with their tasks (Phase 5+).
const { Schema } = mongoose

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'cancelled_by_theatre', 'released']
export const FOOD_PICKUPS = ['before_movie', 'interval'] // SF-06

// One price line with its GST worked back (database.md 2a)
const gstLineSchema = new Schema(
  {
    kind: { type: String, enum: ['ticket', 'food', 'convenience_fee'], required: true },
    seatClass: { type: String, enum: SEAT_CLASSES }, // ticket lines only
    description: { type: String, required: true }, // "2 × First class"
    qty: { type: Number, required: true },
    unitPricePaise: { type: Number, required: true },
    discountPaise: { type: Number, required: true, default: 0 },
    amountPaise: { type: Number, required: true }, // after the discount, GST included
    gstPercent: { type: Number, required: true },
    taxablePaise: { type: Number, required: true },
    cgstPaise: { type: Number, required: true },
    sgstPaise: { type: Number, required: true },
  },
  { _id: false },
)

// Settings values the booking keeps (BR-03, BR-05, BR-11, BR-20)
const ratesSchema = new Schema(
  {
    gst: { ticketPercent: Number, foodPercent: Number, convenienceFeePercent: Number },
    hsnSac: { ticket: String, food: String, convenienceFee: String },
    convenienceFeePaise: Number,
    commissionPercent: Number,
    userRefundTicketPercent: Number,
    userRefundFoodPercent: Number,
    cancelCutoffMinutes: Number, // BR-04, copied from 2026-10-07 (U-20); older bookings use the setting
  },
  { _id: false },
)

const bookingSchema = new Schema(
  {
    bookingNumber: { type: String, required: true }, // 'TK' + 8 easy characters (S-02)
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    showId: { type: Schema.Types.ObjectId, ref: 'Show', required: true },
    movieId: { type: Schema.Types.ObjectId, ref: 'Movie', required: true },
    theatreId: { type: Schema.Types.ObjectId, ref: 'Theatre', required: true },
    screenId: { type: Schema.Types.ObjectId, ref: 'Screen', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cityCode: { type: String, required: true },
    status: { type: String, enum: BOOKING_STATUSES, required: true, default: 'pending' },
    holdExpiresAt: Date, // pending: same as the seats' expiresAt (timer after a refresh, U-12)
    releasedAt: Date,
    confirmedAt: Date, // U-16: paid and confirmed (the confirm transaction)
    // Snapshot: later changes to the show / movie / theatre do not change the booking
    show: {
      movieTitle: { type: String, required: true },
      certificate: { type: String, required: true },
      theatreName: { type: String, required: true },
      theatreAddress: { type: String, required: true },
      screenName: { type: String, required: true },
      startAt: { type: Date, required: true },
      endAt: { type: Date, required: true },
      label: { type: String, required: true },
      language: { type: String, required: true },
      format: { type: String, required: true },
    },
    seats: [
      {
        _id: false,
        seatId: { type: String, required: true },
        seatClass: { type: String, enum: SEAT_CLASSES, required: true },
        className: { type: String, required: true },
        pricePaise: { type: Number, required: true }, // GST included
      },
    ],
    // U-13 food: a copy of name + price at booking time (items can change or be deleted)
    food: [
      {
        _id: false,
        foodItemId: { type: Schema.Types.ObjectId, ref: 'FoodItem', required: true },
        name: { type: String, required: true },
        isVeg: { type: Boolean, required: true },
        unitPricePaise: { type: Number, required: true }, // GST included
        qty: { type: Number, required: true },
      },
    ],
    foodPickup: { type: String, enum: FOOD_PICKUPS }, // SF-06, set only when there is food
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' }, // U-15, not with a deal (BR-16)
    couponCode: String,
    // U-14: calculated by the backend only (SEC-10, services/pricing.js), again after
    // every change (hold, food, coupon). All paise, GST included.
    pricing: {
      ticketsPaise: { type: Number, required: true },
      foodPaise: { type: Number, required: true, default: 0 },
      ticketDiscountPaise: { type: Number, default: 0 }, // deal or coupon, tickets only
      discountType: { type: String, enum: ['deal', 'coupon', null], default: null },
      dealPercent: Number, // fixed at hold time (decided 2026-10-06)
      couponCode: String,
      convenienceFeePaise: Number, // BR-03 × tickets
      gstLines: [gstLineSchema],
      totalPaise: Number,
      rates: ratesSchema, // copy of the settings at hold time (A-05)
    },
    qrNonce: { type: String, required: true }, // random; QR token = booking ID + nonce (SEC-09, U-17)
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' }, // GST invoice, set in the confirm transaction (U-17)
    // U-20 user cancel (O-06 theatre cancel later). refundStatus 'pending' = the gateway
    // refund is not done yet (JOB-04 retries); 'done' = money sent back.
    cancellation: {
      at: Date,
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      refundPaise: Number,
      refundStatus: { type: String, enum: ['pending', 'done'] },
      creditNoteId: { type: Schema.Types.ObjectId, ref: 'Invoice' }, // GST-02 (none for bookings without an invoice)
    },
    // SF-02 ticket transfer (built in Phase 9). Here already because the ticket album (U-18)
    // shows tickets transferred away (transfer.fromUserId = me) as "Transferred".
    transfer: {
      status: { type: String, enum: ['pending_claim', 'done'] },
      fromUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      toEmail: String,
      toUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      claimTokenHash: String,
      requestedAt: Date,
      completedAt: Date,
    },
  },
  { timestamps: true },
)

bookingSchema.index({ bookingNumber: 1 }, { unique: true })
bookingSchema.index({ userId: 1, 'show.startAt': -1 }) // ticket album
bookingSchema.index({ 'transfer.fromUserId': 1 }, { sparse: true }) // ticket album: transferred away
bookingSchema.index({ showId: 1, status: 1 })
bookingSchema.index({ ownerId: 1, createdAt: -1 })
bookingSchema.index({ theatreId: 1, createdAt: -1 })
bookingSchema.index({ status: 1, holdExpiresAt: 1 }) // releasing old pending bookings
bookingSchema.index({ 'cancellation.refundStatus': 1 }, { sparse: true }) // JOB-04: refunds still to send

export const Booking = mongoose.model('Booking', bookingSchema)
