import { FoodItem } from '../models/FoodItem.js'
import { Theatre } from '../models/Theatre.js'
import { AppError } from '../utils/AppError.js'
import { MAX_FOOD_QTY } from '../validation/bookings.js'
import { publicFood } from './ownerFood.js'

// /api/theatres (api.md Section 5): public theatre data for users and guests

// GET /api/theatres/:id/food: U-13 canteen menu (UI-24). Approved theatres only
// (ROLE-04: others look missing). In-stock items first, then A to Z.
export async function getCanteenMenu(req, res) {
  const theatre = await Theatre.findById(req.valid.params.id, 'name status')
  if (!theatre || theatre.status !== 'approved') throw new AppError(404, 'NOT_FOUND', 'We could not find this theatre.')
  const items = await FoodItem.find({ theatreId: theatre._id }).collation({ locale: 'en' }).sort({ inStock: -1, name: 1 })
  res.json({
    theatre: { id: String(theatre._id), name: theatre.name },
    maxQtyPerItem: MAX_FOOD_QTY,
    items: items.map(publicFood).map(({ createdAt, ...item }) => item), // no owner-only fields
  })
}
