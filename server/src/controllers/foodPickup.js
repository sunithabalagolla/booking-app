import { collectFood, lookupFood } from '../services/foodPickup.js'

// /api/food-pickup (api.md Section 9): O-11 canteen counter. Always 200 (found / collected / rejected).

// POST /api/food-pickup/lookup { qrToken | bookingNumber }
export async function lookupFoodOrder(req, res) {
  res.json(await lookupFood(req.valid.body, req.user))
}

// POST /api/food-pickup/collect { qrToken | bookingNumber }
export async function collectFoodOrder(req, res) {
  res.json(await collectFood(req.valid.body, req.user))
}
