import { z } from 'zod'

// O-07 canteen item form. Same rules as the server (server/src/validation/food.js);
// the server checks again. Price: whole rupees ₹1 to ₹5,000, sent in paise.

export const MAX_FOOD_PRICE_RUPEES = 5000
const priceMessage = 'Please enter whole rupees from ₹1 to ₹5,000, e.g. 150.'

export const foodFormSchema = z.object({
  name: z.string().trim().min(1, { error: 'Please enter the item name.' }).max(60, { error: 'The name can have at most 60 characters.' }),
  photoUrl: z.string(),
  price: z
    .string()
    .trim()
    .regex(/^\d+$/, { error: priceMessage })
    .transform(Number)
    .refine((rupees) => rupees >= 1 && rupees <= MAX_FOOD_PRICE_RUPEES, { error: priceMessage }),
  isVeg: z.enum(['veg', 'nonveg'], { error: 'Please pick Veg or Non-veg.' }),
  inStock: z.boolean(),
  isCombo: z.boolean(),
})

export const EMPTY_FOOD = { name: '', photoUrl: '', price: '', isVeg: '', inStock: true, isCombo: false }

// An item from the API → form values
export function foodToForm(item) {
  return {
    name: item.name,
    photoUrl: item.photoUrl ?? '',
    price: String(item.pricePaise / 100),
    isVeg: item.isVeg ? 'veg' : 'nonveg',
    inStock: item.inStock,
    isCombo: item.isCombo,
  }
}

// Checked form values → API body ('' photo = no photo / remove it)
export function formToBody({ name, photoUrl, price, isVeg, inStock, isCombo }) {
  return { name, photoUrl, pricePaise: price * 100, isVeg: isVeg === 'veg', inStock, isCombo }
}

// 15000 → "₹150", 500000 → "₹5,000" (Indian digit groups). With paise: always 2 decimals,
// 3810 → "₹38.10" (never "₹38.1", fixed 2026-10-06)
export function formatRupees(paise) {
  const digits = paise % 100 === 0 ? 0 : 2
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}
