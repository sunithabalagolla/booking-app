import { Booking } from '../models/Booking.js'
import { Coupon } from '../models/Coupon.js'
import { CouponUsage } from '../models/CouponUsage.js'
import { AppError } from '../utils/AppError.js'
import { bookingPricing } from './bookingPrice.js'
import { couponDiscount } from './pricing.js'
import { releaseIfExpired } from './seatHold.js'

// U-15 coupon on a seat hold (BR-16): one coupon per booking, tickets only, never with
// a last-minute deal. Checked here when applied; checked once more at payment (U-16),
// where the use is also counted (usedCount + couponusages).

const holdOver = () => new AppError(400, 'RULE_BROKEN', 'Your seat hold time is over. Please pick seats again.', { rule: 'U-12', reason: 'hold_over' })
const invalid = (reason, message) => new AppError(400, 'COUPON_INVALID', message, { reason })
// Like the client: whole rupees plain, with paise always 2 decimals (₹38.10)
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', paise % 100 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {})}`

// Why a coupon cannot be used for this booking, or null when it can.
// Order (decided 2026-10-06): deal, dates, total uses, own uses, min amount, city, theatre.
export async function couponProblem(coupon, booking, user, now = new Date()) {
  if (booking.pricing?.discountType === 'deal') return invalid('with_deal', 'This show already has a Special offer. Coupons cannot be used with it.')
  if (now < coupon.startAt) return invalid('not_started', 'This coupon is not active yet.')
  if (now > coupon.endAt) return invalid('expired', 'This coupon has ended.')
  if (coupon.totalLimit != null && coupon.usedCount >= coupon.totalLimit) return invalid('used_up', 'This coupon has been fully used.')
  if (coupon.perUserLimit != null && (await CouponUsage.countDocuments({ couponId: coupon._id, userId: user._id })) >= coupon.perUserLimit) {
    return invalid('user_limit', 'You have already used this coupon.')
  }
  if (coupon.minAmountPaise != null && booking.pricing.ticketsPaise < coupon.minAmountPaise) {
    return invalid('min_amount', `This coupon needs tickets worth at least ${rupees(coupon.minAmountPaise)}.`)
  }
  if (coupon.cityCodes?.length && !coupon.cityCodes.includes(booking.cityCode)) return invalid('wrong_city', 'This coupon does not work in this city.')
  if (coupon.theatreIds?.length && !coupon.theatreIds.some((id) => String(id) === String(booking.theatreId))) {
    return invalid('wrong_theatre', 'This coupon does not work at this theatre.')
  }
  return null
}

// Saved only while the hold still runs (the time can end between the check and here)
async function saveWhileHeld(booking, update, now) {
  const saved = await Booking.findOneAndUpdate({ _id: booking._id, status: 'pending', holdExpiresAt: { $gt: now } }, update, { returnDocument: 'after' })
  if (!saved) throw holdOver()
  return saved
}

// code: already uppercase (validation). A new coupon replaces the old one.
export async function applyCoupon(booking, code, user, now = new Date()) {
  if ((await releaseIfExpired(booking, now)).status !== 'pending') throw holdOver()

  const coupon = await Coupon.findOne({ code })
  if (!coupon) throw invalid('not_found', 'We could not find this coupon code.')
  const problem = await couponProblem(coupon, booking, user, now)
  if (problem) throw problem

  const discount = { type: 'coupon', paise: couponDiscount(coupon, booking.pricing.ticketsPaise), couponCode: coupon.code }
  const pricing = await bookingPricing(booking, { discount })
  return saveWhileHeld(booking, { $set: { couponId: coupon._id, couponCode: coupon.code, pricing } }, now)
}

// Back to the price without a coupon (a deal stays: it is not a coupon). Again = fine.
export async function removeCoupon(booking, now = new Date()) {
  if ((await releaseIfExpired(booking, now)).status !== 'pending') throw holdOver()
  if (booking.pricing?.discountType !== 'coupon') return booking
  const pricing = await bookingPricing(booking, { discount: {} })
  return saveWhileHeld(booking, { $set: { pricing }, $unset: { couponId: 1, couponCode: 1 } }, now)
}

// U-15 "Available offers" (added 2026-10-06): the public coupons ("Show to users", A-06)
// that work for this booking right now, checked with the same rules as Apply, so the
// list never offers one that would be refused. None on a deal show (BR-16). Biggest
// saving first, at most 10.
const MAX_OFFERS = 10
export async function availableOffers(booking, user, now = new Date()) {
  if ((await releaseIfExpired(booking, now)).status !== 'pending') throw holdOver()
  if (booking.pricing?.discountType === 'deal') return []

  const candidates = await Coupon.find({ isPublic: true, startAt: { $lte: now }, endAt: { $gte: now } })
  const offers = []
  for (const coupon of candidates) {
    if (await couponProblem(coupon, booking, user, now)) continue
    offers.push({
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value,
      maxDiscountPaise: coupon.maxDiscountPaise ?? null,
      minAmountPaise: coupon.minAmountPaise ?? null,
      endAt: coupon.endAt,
      savingPaise: couponDiscount(coupon, booking.pricing.ticketsPaise), // for this booking
      applied: booking.couponCode === coupon.code,
    })
  }
  return offers.sort((a, b) => b.savingPaise - a.savingPaise || a.code.localeCompare(b.code)).slice(0, MAX_OFFERS)
}
