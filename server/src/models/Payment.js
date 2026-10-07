import mongoose from 'mongoose'

// payments collection (database.md 5.12, PAY-04): one document per payment attempt.
// created → success / failed → refunded / partially_refunded. A booking can have several
// attempts (after a failure, or a new order that replaced an unpaid one).
const { Schema } = mongoose

export const PAYMENT_STATUSES = ['created', 'success', 'failed', 'refunded', 'partially_refunded']
export const PAYMENT_METHODS = ['upi', 'card', 'netbanking']

const paymentSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: String, required: true }, // from createOrder
    paymentId: String, // from the gateway after paying
    capturedAt: Date, // mock "payment captured" webhook: money taken, maybe not verified yet (JOB-02)
    method: { type: String, enum: PAYMENT_METHODS },
    amountPaise: { type: Number, required: true }, // always from the backend (SEC-10)
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'created' },
    failureReason: String, // 'declined' · 'replaced' (a newer order) · 'timeout' (JOB-02: never paid)
    refunds: [
      {
        _id: false,
        refundId: { type: String, required: true },
        amountPaise: { type: Number, required: true },
        reason: { type: String, required: true }, // 'hold_expired' · 'amount_changed' · JOB-02: 'seats_taken' · 'show_closed' · 'booking_closed' · later: cancellations
        at: { type: Date, required: true },
        creditNoteId: { type: Schema.Types.ObjectId, ref: 'Invoice' }, // 11.3 (later)
        payoutId: { type: Schema.Types.ObjectId, ref: 'Payout' }, // 11.1 (later)
      },
    ],
  },
  { timestamps: true },
)

paymentSchema.index({ orderId: 1 }, { unique: true })
paymentSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } })
paymentSchema.index({ bookingId: 1 })
paymentSchema.index({ status: 1, createdAt: 1 }) // JOB-02

export const Payment = mongoose.model('Payment', paymentSchema)
