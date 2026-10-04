import { findOwned } from '../middleware/ownership.js'
import { FoodItem } from '../models/FoodItem.js'
import { Theatre } from '../models/Theatre.js'
import { AppError } from '../utils/AppError.js'

// O-07 owner canteen items (api.md Section 8). Own theatres / items only (ROLE-02).
// Rules (decided 2026-10-04):
// - items can be added to pending and rejected theatres too
// - whole rupees ₹1–₹5,000 (validation/food.js); one name per theatre
// - real delete is allowed: bookings keep their own copy of name + price

export function publicFood(item) {
  return {
    id: String(item._id),
    theatreId: String(item.theatreId),
    name: item.name,
    photoUrl: item.photoUrl ?? null,
    pricePaise: item.pricePaise,
    isVeg: item.isVeg,
    inStock: item.inStock,
    isCombo: item.isCombo,
    createdAt: item.createdAt,
  }
}

const briefTheatre = (theatre) => ({ id: String(theatre._id), name: theatre.name, status: theatre.status })

// Unique index { theatreId, name } → a clear message on the name field
async function saveFood(item) {
  try {
    return await item.save()
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'ALREADY_EXISTS', 'This canteen already has an item with this name.', { name: 'This canteen already has an item with this name.' })
    }
    throw error
  }
}

// GET /api/owner/theatres/:id/food: all items, also out of stock (A to Z)
export async function listTheatreFood(req, res) {
  const theatre = await findOwned(Theatre, req.valid.params.id, req.user, { theatreField: '_id' })
  const items = await FoodItem.find({ theatreId: theatre._id }).collation({ locale: 'en' }).sort({ name: 1 })
  res.json({ theatre: briefTheatre(theatre), items: items.map(publicFood) })
}

// POST /api/owner/theatres/:id/food
export async function createFood(req, res) {
  const { photoUrl, ...body } = req.valid.body
  const theatre = await findOwned(Theatre, req.valid.params.id, req.user, { theatreField: '_id' })
  const item = await saveFood(new FoodItem({ ...body, photoUrl: photoUrl || undefined, theatreId: theatre._id, ownerId: theatre.ownerId }))
  res.status(201).json({ food: publicFood(item) })
}

// PATCH /api/owner/food/:id
export async function updateFood(req, res) {
  const item = await findOwned(FoodItem, req.valid.params.id, req.user)
  for (const [key, value] of Object.entries(req.valid.body)) {
    if (value === undefined) continue
    item[key] = key === 'photoUrl' ? value || undefined : value // '' removes the photo
  }
  await saveFood(item)
  res.json({ food: publicFood(item) })
}

// DELETE /api/owner/food/:id
export async function deleteFood(req, res) {
  const item = await findOwned(FoodItem, req.valid.params.id, req.user)
  await item.deleteOne()
  res.status(204).end()
}
