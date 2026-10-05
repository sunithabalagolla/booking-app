import mongoose from 'mongoose'
import { SEAT_CLASSES } from '../utils/seatLayout.js'

// bookings collection (database.md 5.11). U-12 (Phase 4) makes `pending` bookings
// (seats held) and releases them. Food, coupon, full pricing with GST lines, payment,
// QR, check-in, cancel and transfer fields come with their tasks (Phase 5+).
const { Schema } = mongoose

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'cancelled_by_theatre', 'released']

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
    // Calculated by the backend only (SEC-10). Phase 4: tickets only; fee, food,
    // discounts and GST lines come with U-14 (Phase 5).
    pricing: {
      ticketsPaise: { type: Number, required: true },
    },
    qrNonce: { type: String, required: true }, // random; QR token = booking ID + nonce (SEC-09, U-17)
  },
  { timestamps: true },
)

bookingSchema.index({ bookingNumber: 1 }, { unique: true })
bookingSchema.index({ userId: 1, 'show.startAt': -1 }) // ticket album
bookingSchema.index({ showId: 1, status: 1 })
bookingSchema.index({ ownerId: 1, createdAt: -1 })
bookingSchema.index({ theatreId: 1, createdAt: -1 })
bookingSchema.index({ status: 1, holdExpiresAt: 1 }) // releasing old pending bookings

export const Booking = mongoose.model('Booking', bookingSchema)
