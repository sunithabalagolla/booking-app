import mongoose from 'mongoose'

// coupons collection (database.md 5.15, A-06, U-15). Tickets only (BR-16).
// usedCount goes up by 1 when a booking with the coupon is confirmed (U-16) and is
// not given back when the booking is cancelled.
const { Schema } = mongoose

export const COUPON_TYPES = ['percent', 'flat']

const couponSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    discountType: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, required: true }, // percent (1–100) or paise (flat)
    minAmountPaise: Number, // of the tickets
    maxDiscountPaise: Number,
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    totalLimit: Number, // empty = no limit
    perUserLimit: Number, // empty = no limit
    usedCount: { type: Number, required: true, default: 0 },
    cityCodes: { type: [String], default: [] }, // empty = all cities
    theatreIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Theatre' }], default: [] }, // empty = all theatres
    isPublic: { type: Boolean, required: true, default: false }, // "Show to users": listed in Available offers (U-15); off = secret code
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // admin
    isSample: Boolean, // seeded test data (15.5)
  },
  { timestamps: true },
)

couponSchema.index({ code: 1 }, { unique: true })
couponSchema.index({ isPublic: 1, endAt: 1 }) // Available offers (U-15)
couponSchema.index({ createdAt: -1 }) // admin register, newest first

export const Coupon = mongoose.model('Coupon', couponSchema)
