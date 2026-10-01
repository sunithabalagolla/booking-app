import mongoose from 'mongoose'
import { AppError } from '../utils/AppError.js'

// ROLE-02 ownership checks (api.md 1.3 "own").
//
// ownedFilter(user) gives the part of a database filter that keeps only this
// person's data:
//   owner → items with ownerId = me
//   staff → items of one of my theatres
//   user  → items with userId = me (e.g. my bookings)
//   admin → everything
// `theatreField` is the field that holds the theatre ID ('theatreId' on screens,
// shows, bookings…; '_id' on the theatres collection itself).
export function ownedFilter(user, { theatreField = 'theatreId' } = {}) {
  switch (user.role) {
    case 'admin':
      return {}
    case 'owner':
      return { ownerId: user._id }
    case 'staff':
      return { [theatreField]: { $in: user.staff?.theatreIds ?? [] } }
    default:
      return { userId: user._id }
  }
}

const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this.')

// Loads one item by ID, only if it belongs to this person.
// Not theirs (or not there) → 404, so others cannot find out that it exists.
export async function findOwned(Model, id, user, options) {
  if (!mongoose.isValidObjectId(id)) throw notFound()
  // $and, so { _id } and the owner filter never overwrite each other (theatreField '_id')
  const item = await Model.findOne({ $and: [{ _id: id }, ownedFilter(user, options)] })
  if (!item) throw notFound()
  return item
}
