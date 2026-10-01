import mongoose from 'mongoose'
import { CERTIFICATES, GENRES, LANGUAGES, MOVIE_STATUSES } from '../config/movieOptions.js'

// movies collection (database.md 5.6, A-02). Only admins add / edit movies.
const { Schema } = mongoose

const movieSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    posterUrl: { type: String, required: true }, // Cloudinary URL (NF-08); local file link in development
    trailerUrl: String,
    cast: [{ _id: false, name: { type: String, required: true, trim: true }, photoUrl: String }],
    genres: { type: [{ type: String, enum: GENRES }], required: true },
    languages: { type: [{ type: String, enum: LANGUAGES }], required: true },
    durationMinutes: { type: Number, required: true }, // BR-10 show end time
    certificate: { type: String, enum: CERTIFICATES, required: true },
    releaseDate: { type: Date, required: true }, // 00:00 IST of the release day, stored in UTC (BR-21)
    status: { type: String, enum: MOVIE_STATUSES, required: true },
    ratingAvg: { type: Number, required: true, default: 0 }, // U-07, U-23
    ratingCount: { type: Number, required: true, default: 0 },
    isSample: Boolean, // seeded test data (15.5)
  },
  { timestamps: true },
)

movieSchema.index({ status: 1, releaseDate: 1 })
movieSchema.index({ title: 'text' })
movieSchema.index({ genres: 1 })
movieSchema.index({ languages: 1 })

export const Movie = mongoose.model('Movie', movieSchema)
