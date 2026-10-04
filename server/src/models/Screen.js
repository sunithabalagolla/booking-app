import mongoose from 'mongoose'
import { CELL_TYPES, SEAT_CLASSES } from '../utils/seatLayout.js'

// screens collection (database.md 5.8, O-04)
const { Schema } = mongoose

export const SCREEN_FORMATS = ['2D', '3D']

const cellSchema = new Schema(
  {
    type: { type: String, enum: CELL_TYPES, required: true },
    seatId: String, // seats only, e.g. 'A4'
    seatClass: { type: String, enum: SEAT_CLASSES }, // seats only (UI-22)
    wheelchair: Boolean, // seats only
  },
  { _id: false },
)

const rowSchema = new Schema(
  {
    label: { type: String, default: null }, // null = row without seats
    cells: [cellSchema],
  },
  { _id: false },
)

const screenSchema = new Schema(
  {
    theatreId: { type: Schema.Types.ObjectId, ref: 'Theatre', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // copy from the theatre (ROLE-02)
    name: { type: String, required: true, trim: true },
    format: { type: String, enum: SCREEN_FORMATS, required: true },
    cleaningBreakMinutes: { type: Number, required: true }, // BR-09
    wheelchairFriendly: { type: Boolean, required: true, default: false }, // automatic: at least 1 wheelchair space (SF-08)
    layout: {
      rows: { type: Number, required: true },
      cols: { type: Number, required: true },
      grid: [rowSchema],
    },
    seatCount: {
      balcony: { type: Number, required: true, default: 0 },
      first: { type: Number, required: true, default: 0 },
      second: { type: Number, required: true, default: 0 },
    },
    // O-05: +1 inside every show save transaction. Two saves on the same screen at the
    // same moment then write the same document, so MongoDB lets only one win; the other
    // is retried and sees the first one's show in the overlap check (T-08).
    showLock: { type: Number, default: 0 },
    isSample: Boolean, // seeded test data (15.5)
  },
  { timestamps: true },
)

screenSchema.index({ theatreId: 1, name: 1 }, { unique: true })

export const Screen = mongoose.model('Screen', screenSchema)
