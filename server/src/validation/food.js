import { z } from 'zod'
import { imageUrlField } from './common.js'

// O-07 canteen item fields (api.md Section 8)

// Whole rupees only, ₹1 to ₹5,000, sent in paise (decided 2026-10-04)
export const MIN_FOOD_PRICE_PAISE = 100
export const MAX_FOOD_PRICE_PAISE = 500000
const priceMessage = 'The price must be whole rupees from ₹1 to ₹5,000.'

const foodFields = {
  name: z.string({ error: 'Please enter the item name.' }).trim().min(1, { error: 'Please enter the item name.' }).max(60, { error: 'The name can have at most 60 characters.' }),
  photoUrl: z.union([imageUrlField, z.literal('')]).optional(), // '' = no photo
  pricePaise: z
    .number({ error: priceMessage })
    .int({ error: priceMessage })
    .min(MIN_FOOD_PRICE_PAISE, { error: priceMessage })
    .max(MAX_FOOD_PRICE_PAISE, { error: priceMessage })
    .refine((paise) => paise % 100 === 0, { error: priceMessage }),
  isVeg: z.boolean({ error: 'Please pick Veg or Non-veg.' }),
  inStock: z.boolean(),
  isCombo: z.boolean(),
}

export const createFoodSchema = z.object({ ...foodFields, inStock: foodFields.inStock.optional(), isCombo: foodFields.isCombo.optional() })

export const updateFoodSchema = z
  .object(foodFields)
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), { error: 'Nothing to change.' })
