import { Coupon } from '../../models/Coupon.js'
import { User } from '../../models/User.js'
import { istDayToDate, istToday } from '../../utils/time.js'
import { SAMPLE } from '../sample.js'
import { SEED_LOGINS } from './users.js'

// Seed step: 2 sample coupons (15.5), tickets only (BR-16), every city. Valid from
// yesterday for 90 days. Upsert by code (no usedCount change), so the seed can run again.
export const SAMPLE_COUPONS = [
  // 20% off, at most ₹100, tickets worth at least ₹200
  { code: 'TALKIES20', discountType: 'percent', value: 20, maxDiscountPaise: 10000, minAmountPaise: 20000 },
  // ₹50 off, once per user
  { code: 'FLAT50', discountType: 'flat', value: 5000, perUserLimit: 1 },
]

export default {
  name: 'coupons',
  async run() {
    const admin = await User.findOne({ email: SEED_LOGINS.admin })
    const startAt = istDayToDate(istToday(-1))
    const endAt = istDayToDate(istToday(90))
    for (const c of SAMPLE_COUPONS) {
      await Coupon.findOneAndUpdate(
        { code: c.code },
        { $set: { ...c, startAt, endAt, cityCodes: [], theatreIds: [], createdBy: admin._id, ...SAMPLE } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      )
    }
    return [`Coupons: ${SAMPLE_COUPONS.map((c) => c.code).join(', ')} (sample, 90 days)`]
  },
}
