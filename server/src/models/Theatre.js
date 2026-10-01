import mongoose from 'mongoose'

// theatres collection (database.md 5.7, O-03, A-04)
const { Schema } = mongoose

export const THEATRE_STATUSES = ['pending', 'approved', 'rejected']

const theatreSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // ROLE-02
    name: { type: String, required: true, trim: true },
    cityCode: { type: String, required: true }, // a code from settings.cities
    address: { type: String, required: true, trim: true },
    mapLink: String,
    photos: [String], // max 6 (O-03)
    gstin: { type: String, required: true }, // seller on the invoice (11.3); state code = city's state
    amenities: {
      wheelchairAccess: { type: Boolean, required: true, default: false },
      parking: { type: Boolean, required: true, default: false },
    },
    status: { type: String, enum: THEATRE_STATUSES, required: true, default: 'pending' }, // ROLE-04
    rejectReason: String, // A-04
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    isSample: Boolean, // seeded test data (15.5)
  },
  { timestamps: true },
)

theatreSchema.index({ ownerId: 1 })
theatreSchema.index({ cityCode: 1, status: 1 })
theatreSchema.index({ status: 1, createdAt: 1 })

export const Theatre = mongoose.model('Theatre', theatreSchema)
