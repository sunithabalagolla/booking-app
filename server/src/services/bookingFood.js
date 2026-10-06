import { Booking } from '../models/Booking.js'
import { FoodItem } from '../models/FoodItem.js'
import { AppError } from '../utils/AppError.js'
import { bookingPricing } from './bookingPrice.js'
import { releaseIfExpired } from './seatHold.js'

// U-13 food for a seat hold (SF-06 pickup time). The client sends only item IDs and
// counts; names and prices are read here and copied into the booking (SEC-10), so later
// menu changes never change this booking.

const holdOver = () => new AppError(400, 'RULE_BROKEN', 'Your seat hold time is over. Please pick seats again.', { rule: 'U-12', reason: 'hold_over' })

// booking: the user's own booking. items: [{ foodItemId, qty }] (checked by Zod).
// Returns the saved booking.
export async function setBookingFood(booking, { items, pickup }, now = new Date()) {
  if ((await releaseIfExpired(booking, now)).status !== 'pending') throw holdOver()

  // Only this theatre's items; sold-out items cannot be added
  const ids = items.map((i) => i.foodItemId)
  const found = new Map((await FoodItem.find({ _id: { $in: ids }, theatreId: booking.theatreId })).map((f) => [String(f._id), f]))
  const missing = ids.filter((id) => !found.has(id))
  if (missing.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'An item is not on this canteen menu any more. Please look at the menu again.', { foodItemIds: missing })
  }
  const soldOut = ids.filter((id) => !found.get(id).inStock)
  if (soldOut.length) {
    const names = soldOut.map((id) => found.get(id).name).join(', ')
    throw new AppError(400, 'RULE_BROKEN', `${names} ${soldOut.length === 1 ? 'is' : 'are'} sold out now.`, { rule: 'U-13', reason: 'sold_out', foodItemIds: soldOut })
  }

  const food = items.map(({ foodItemId, qty }) => {
    const item = found.get(foodItemId)
    return { foodItemId: item._id, name: item.name, isVeg: item.isVeg, unitPricePaise: item.pricePaise, qty }
  })
  // U-14: the whole price again with the new food (the discount stays)
  const pricing = await bookingPricing(booking, { food })

  // Saved only while the hold still runs (the time can end between the check and here)
  const update = food.length ? { $set: { food, foodPickup: pickup, pricing } } : { $set: { food: [], pricing }, $unset: { foodPickup: 1 } }
  const saved = await Booking.findOneAndUpdate({ _id: booking._id, status: 'pending', holdExpiresAt: { $gt: now } }, update, { returnDocument: 'after' })
  if (!saved) throw holdOver()
  return saved
}
