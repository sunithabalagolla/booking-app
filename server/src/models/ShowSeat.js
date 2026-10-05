import mongoose from 'mongoose'

// showseats collection (database.md 5.10, 9.3): one document per TAKEN seat of a show
// (held or booked). No document = the seat is available. Blocked seats come from the
// layout and are never here. Holding seats comes with U-12; U-10 only reads them.
const { Schema } = mongoose

export const SEAT_STATUSES = ['held', 'booked']

const showSeatSchema = new Schema(
  {
    showId: { type: Schema.Types.ObjectId, ref: 'Show', required: true },
    seatId: { type: String, required: true }, // e.g. 'F4', from the show layout
    status: { type: String, enum: SEAT_STATUSES, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' }, // required except for a waitlist offer (SF-04)
    waitlistId: { type: Schema.Types.ObjectId, ref: 'Waitlist' }, // SF-04 (Phase 9)
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: Date, // held only: now + holdMinutes (BR-01); removed when booked
  },
  { timestamps: true },
)

showSeatSchema.index({ showId: 1, seatId: 1 }, { unique: true }) // the lock: only one user can take a seat
// TTL: deletes expired holds about every 60 s. NOT exact: every check must also test
// expiresAt > now itself (database.md Section 3)
showSeatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
showSeatSchema.index({ bookingId: 1 })
showSeatSchema.index({ waitlistId: 1 }, { sparse: true })

// Filter for seats that are really taken right now (booked, or held and not expired yet)
export const takenNow = (now = new Date()) => ({ $or: [{ status: 'booked' }, { expiresAt: { $gt: now } }] })

export const ShowSeat = mongoose.model('ShowSeat', showSeatSchema)
