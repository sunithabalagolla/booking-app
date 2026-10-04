import mongoose from 'mongoose'

// fooditems collection (database.md 5.14, O-07). Bookings copy name + price
// (database.md 5.11), so edits and deletes never change old bookings.
const { Schema } = mongoose

const foodItemSchema = new Schema(
  {
    theatreId: { type: Schema.Types.ObjectId, ref: 'Theatre', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // copy from the theatre (ROLE-02)
    name: { type: String, required: true, trim: true },
    photoUrl: String,
    pricePaise: { type: Number, required: true }, // GST included (database.md 2a)
    isVeg: { type: Boolean, required: true },
    inStock: { type: Boolean, required: true, default: true },
    isCombo: { type: Boolean, required: true, default: false },
    isSample: Boolean, // seeded test data (15.5)
  },
  { timestamps: true },
)

// One name per theatre (decided 2026-10-04); also the canteen list per theatre
foodItemSchema.index({ theatreId: 1, name: 1 }, { unique: true })

export const FoodItem = mongoose.model('FoodItem', foodItemSchema)
