import mongoose from 'mongoose'

// counters collection (database.md 5.5): numbers that go up one by one without
// duplicates, e.g. _id 'invoice:2026-27'. Used inside transactions, so an aborted
// booking does not use up a number.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
})

export const Counter = mongoose.model('Counter', counterSchema)

// The next number of a series (inside the given transaction)
export async function nextSeq(id, session) {
  const counter = await Counter.findOneAndUpdate({ _id: id }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
  return counter.seq
}
