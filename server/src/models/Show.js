import mongoose from 'mongoose'
import { LANGUAGES } from '../config/movieOptions.js'
import { SHOW_LABELS } from '../utils/showTime.js'
import { SEAT_CLASSES } from '../utils/seatLayout.js'
import { SCREEN_FORMATS } from './Screen.js'

// shows collection (database.md 5.9, O-05; cancel O-06 and deals O-12 come later)
const { Schema } = mongoose

export const SHOW_STATUSES = ['scheduled', 'cancelled']
export const SHOW_TAGS = ['parent_baby'] // SF-08

// Same shape as a screen cell (a field called "type" needs { type: String })
const cellSchema = new Schema({ type: { type: String }, seatId: String, seatClass: String, wheelchair: Boolean }, { _id: false })

const showSchema = new Schema(
  {
    movieId: { type: Schema.Types.ObjectId, ref: 'Movie', required: true },
    theatreId: { type: Schema.Types.ObjectId, ref: 'Theatre', required: true },
    screenId: { type: Schema.Types.ObjectId, ref: 'Screen', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // ROLE-02
    cityCode: { type: String, required: true }, // copy from the theatre (U-04)
    startAt: { type: Date, required: true }, // UTC
    endAt: { type: Date, required: true }, // BR-10: start + duration + cleaning break
    label: { type: String, enum: SHOW_LABELS, required: true }, // BR-22, from startAt in IST
    language: { type: String, enum: LANGUAGES, required: true }, // one of the movie's languages
    format: { type: String, enum: SCREEN_FORMATS, required: true },
    subtitles: { type: Boolean, required: true, default: false }, // SF-08
    tags: [{ type: String, enum: SHOW_TAGS }], // SF-08; parent_baby never on an "A" movie
    wheelchairFriendly: { type: Boolean, required: true, default: false }, // copy from the screen (SF-08)
    prices: [{ _id: false, seatClass: { type: String, enum: SEAT_CLASSES, required: true }, pricePaise: { type: Number, required: true } }], // GST included
    // Copy of the screen layout when the show is made: later layout edits do not change it
    layout: {
      rows: { type: Number, required: true },
      cols: { type: Number, required: true },
      grid: [{ _id: false, label: { type: String, default: null }, cells: [cellSchema] }],
    },
    totalSeats: { type: Number, required: true },
    bookedCount: { type: Number, required: true, default: 0 }, // == totalSeats → Housefull (U-09)
    deal: {
      // O-12 (Phase 9)
      enabled: { type: Boolean, default: false },
      percent: Number,
      active: { type: Boolean, default: false },
    },
    status: { type: String, enum: SHOW_STATUSES, required: true, default: 'scheduled' },
    cancelReason: String, // O-06 (Phase 6)
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    isSample: Boolean, // seeded test data (15.5)
  },
  { timestamps: true },
)

showSchema.index({ screenId: 1, startAt: 1 }) // overlap check (T-08)
showSchema.index({ cityCode: 1, status: 1, startAt: 1 }) // U-09 show list
showSchema.index({ movieId: 1, cityCode: 1, startAt: 1 })
showSchema.index({ theatreId: 1, startAt: 1 }) // owner lists, dashboards
showSchema.index({ status: 1, endAt: 1 }) // payouts, completed shows

export const Show = mongoose.model('Show', showSchema)
