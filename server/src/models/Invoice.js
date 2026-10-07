import mongoose from 'mongoose'

// invoices collection (database.md 5.13, 11.3): GST tax invoices (U-17) and, later,
// credit notes (GST-02, Phase 6). The PDF is made from this data when downloaded;
// no file is stored. Everything is a snapshot: later changes never change an invoice.
const { Schema } = mongoose

const lineSchema = new Schema(
  {
    kind: { type: String, enum: ['ticket', 'food', 'convenience_fee'], required: true },
    description: { type: String, required: true },
    hsnSac: { type: String, default: null },
    qty: { type: Number, required: true },
    taxablePaise: { type: Number, required: true },
    gstPercent: { type: Number, required: true },
    cgstPaise: { type: Number, required: true },
    sgstPaise: { type: Number, required: true },
    totalPaise: { type: Number, required: true }, // GST included
  },
  { _id: false },
)

const invoiceSchema = new Schema(
  {
    type: { type: String, enum: ['invoice', 'credit_note'], required: true },
    number: { type: String, required: true }, // INV/2026-27/000123
    financialYear: { type: String, required: true }, // 2026-27
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    bookingNumber: { type: String, required: true },
    theatreId: { type: Schema.Types.ObjectId, ref: 'Theatre', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' }, // removed on account delete (U-26)
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' }, // credit notes only
    issuedAt: { type: Date, required: true },
    seller: {
      theatreName: { type: String, required: true },
      address: { type: String, required: true },
      gstin: { type: String, required: true },
      state: { type: String, required: true }, // CGST + SGST of this state on every line
    },
    platform: { companyName: String, gstin: String, address: String },
    buyer: { name: String, email: String },
    lines: [lineSchema],
    totals: {
      taxablePaise: { type: Number, required: true },
      cgstPaise: { type: Number, required: true },
      sgstPaise: { type: Number, required: true },
      totalPaise: { type: Number, required: true },
    },
  },
  { timestamps: true },
)

invoiceSchema.index({ number: 1 }, { unique: true })
invoiceSchema.index({ bookingId: 1 })
invoiceSchema.index({ ownerId: 1, issuedAt: 1 }) // GST-03 monthly reports
invoiceSchema.index({ issuedAt: 1 })

export const Invoice = mongoose.model('Invoice', invoiceSchema)
