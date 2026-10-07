import { GST_STATE_CODES } from '../config/gstStates.js'
import { nextSeq } from '../models/Counter.js'
import { Invoice } from '../models/Invoice.js'
import { Settings } from '../models/Settings.js'
import { Theatre } from '../models/Theatre.js'
import { User } from '../models/User.js'
import { dateToIstDay } from '../utils/time.js'

// GST tax invoice (11.3, U-17). Made inside the confirm transaction (database.md 2),
// so a booking that is not confirmed never uses up an invoice number.
// The lines come straight from booking.pricing.gstLines (T-05), so the invoice total is
// always exactly the amount paid.

// Financial year in IST: 1 April … 31 March → '2026-27'
export function financialYear(date) {
  const [y, m] = dateToIstDay(date).split('-').map(Number)
  const start = m >= 4 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

// 'INV/2026-27/000123' (6 digits; more digits after 999,999 invoices in a year)
export const invoiceNumber = (prefix, fy, seq) => `${prefix}/${fy}/${String(seq).padStart(6, '0')}`

const KIND_TEXT = { ticket: 'Movie ticket', food: 'Food', convenience_fee: 'Convenience fee' }
const HSN_KEY = { ticket: 'ticket', food: 'food', convenience_fee: 'convenienceFee' }

// booking pricing → invoice lines + totals
export function invoiceLines(pricing) {
  const lines = pricing.gstLines.map((l) => ({
    kind: l.kind,
    description: l.kind === 'convenience_fee' ? `${KIND_TEXT[l.kind]} (${l.qty} ${l.qty === 1 ? 'ticket' : 'tickets'})` : `${KIND_TEXT[l.kind]}: ${l.description}`,
    hsnSac: pricing.rates?.hsnSac?.[HSN_KEY[l.kind]] ?? null,
    qty: l.qty,
    taxablePaise: l.taxablePaise,
    gstPercent: l.gstPercent,
    cgstPaise: l.cgstPaise,
    sgstPaise: l.sgstPaise,
    totalPaise: l.amountPaise,
  }))
  const sum = (key) => lines.reduce((total, l) => total + l[key], 0)
  return { lines, totals: { taxablePaise: sum('taxablePaise'), cgstPaise: sum('cgstPaise'), sgstPaise: sum('sgstPaise'), totalPaise: sum('totalPaise') } }
}

// The theatre's GST state: its city's state in settings; else from the GSTIN state code
function sellerState(theatre, settings) {
  const city = settings.cities?.find((c) => c.code === theatre.cityCode)
  if (city) return city.state
  const code = theatre.gstin.slice(0, 2)
  return Object.keys(GST_STATE_CODES).find((state) => GST_STATE_CODES[state] === code) ?? code
}

// Creates the invoice of a booking being confirmed (inside `session`) → the invoice
export async function createInvoice(booking, { session, now = new Date() }) {
  const [theatre, settings, buyer] = await Promise.all([
    Theatre.findById(booking.theatreId).session(session),
    Settings.findById('platform').session(session),
    User.findById(booking.userId).session(session),
  ])
  const fy = financialYear(now)
  const seq = await nextSeq(`invoice:${fy}`, session)
  const { lines, totals } = invoiceLines(booking.pricing)
  const [invoice] = await Invoice.create(
    [
      {
        type: 'invoice',
        number: invoiceNumber('INV', fy, seq),
        financialYear: fy,
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        theatreId: booking.theatreId,
        ownerId: booking.ownerId,
        userId: booking.userId,
        issuedAt: now,
        seller: { theatreName: theatre.name, address: theatre.address, gstin: theatre.gstin, state: sellerState(theatre, settings ?? {}) },
        platform: { companyName: settings?.platform?.companyName ?? null, gstin: settings?.platform?.gstin ?? null, address: settings?.platform?.address ?? null },
        buyer: { name: buyer?.name ?? '', email: buyer?.email ?? '' },
        lines,
        totals,
      },
    ],
    { session },
  )
  return invoice
}
