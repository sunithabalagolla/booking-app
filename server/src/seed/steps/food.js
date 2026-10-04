import { FoodItem } from '../../models/FoodItem.js'
import { Theatre } from '../../models/Theatre.js'
import { storeImage } from '../../services/upload/index.js'
import { foodSvg } from '../foodPictures.js'
import { SAMPLE } from '../sample.js'

// Seed step: 6 made-up canteen items for every sample theatre (15.5).
// Pictures are vintage SVGs drawn by code (seed/foodPictures.js), saved once like
// uploads and shared by all theatres. Prices in whole rupees, GST included.
// Upsert by theatre + name, so the seed can run again.

// label = short text on the picture
export const FOOD = [
  { name: 'Butter Popcorn', label: 'Popcorn', picture: 'popcorn', pricePaise: 15000, isVeg: true, isCombo: false },
  { name: 'Samosa (2 pcs)', label: 'Samosa', picture: 'samosa', pricePaise: 6000, isVeg: true, isCombo: false },
  { name: 'Filter Coffee', label: 'Filter Coffee', picture: 'coffee', pricePaise: 4000, isVeg: true, isCombo: false },
  { name: 'Cold Drink', label: 'Cold Drink', picture: 'drink', pricePaise: 8000, isVeg: true, isCombo: false },
  { name: 'Chicken Puff', label: 'Chicken Puff', picture: 'puff', pricePaise: 7000, isVeg: false, isCombo: false },
  { name: 'Popcorn + Cold Drink Combo', label: 'Combo', picture: 'combo', pricePaise: 20000, isVeg: true, isCombo: true },
]

export default {
  name: 'food',
  async run() {
    // One picture per item, shared by all theatres
    const photos = {}
    for (const f of FOOD) {
      const svg = foodSvg({ name: f.label, picture: f.picture, isVeg: f.isVeg })
      photos[f.name] = await storeImage(Buffer.from(svg), { kind: 'food', ext: 'svg', name: `sample-${f.picture}` })
    }

    const theatres = await Theatre.find({ isSample: true })
    for (const theatre of theatres) {
      for (const f of FOOD) {
        await FoodItem.findOneAndUpdate(
          { theatreId: theatre._id, name: f.name },
          {
            $set: {
              theatreId: theatre._id,
              ownerId: theatre.ownerId,
              name: f.name,
              photoUrl: photos[f.name],
              pricePaise: f.pricePaise,
              isVeg: f.isVeg,
              inStock: true,
              isCombo: f.isCombo,
              ...SAMPLE,
            },
          },
          { upsert: true, runValidators: true, setDefaultsOnInsert: true },
        )
      }
    }
    return [`Canteen: ${FOOD.length} sample food items per theatre (${FOOD.length * theatres.length} in all)`]
  },
}
