import mongoose from 'mongoose'

// couponusages collection (database.md 5.16): one per confirmed booking with a coupon.
// Written in the confirm transaction (U-16); U-15 only counts them (per-user limit).
const { Schema } = mongoose

const couponUsageSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  },
  { timestamps: true },
)

couponUsageSchema.index({ couponId: 1, userId: 1 }) // per-user limit
couponUsageSchema.index({ bookingId: 1 }, { unique: true })

export const CouponUsage = mongoose.model('CouponUsage', couponUsageSchema)
