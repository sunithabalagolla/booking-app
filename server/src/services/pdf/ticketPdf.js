import { qrPng } from '../qr/index.js'
import { ticketDetails } from '../ticketText.js'
import { COLORS, FONTS, newDoc, toBuffer } from './common.js'

// U-17 ticket PDF: the UI-27 paper ticket on an A4 page. Cream ticket with a maroon
// border, details + QR on the left, counterfoil behind a dotted line on the right.

const X = 40
const Y = 50
const W = 515
const H = 330
const STUB_W = 130 // counterfoil
const MAIN_W = W - STUB_W

export async function ticketPdf(booking) {
  const t = ticketDetails(booking)
  const qr = await qrPng(booking)
  const doc = newDoc(`Talkies ticket ${t.bookingNumber}`)

  // Paper + border (double line like an old printed ticket)
  doc.roundedRect(X, Y, W, H, 10).fill(COLORS.cream)
  doc.lineWidth(2).roundedRect(X, Y, W, H, 10).stroke(COLORS.maroon)
  doc.lineWidth(0.6).roundedRect(X + 5, Y + 5, W - 10, H - 10, 7).stroke(COLORS.maroon)

  // Header: TALKIES + "Admit n"
  doc.font(FONTS.heading).fontSize(22).fillColor(COLORS.maroon).text('TALKIES', X + 20, Y + 18)
  const admit = `ADMIT ${t.admit}`
  doc.font(FONTS.heading).fontSize(13)
  const admitW = doc.widthOfString(admit) + 16
  doc.lineWidth(1.2).rect(X + MAIN_W - admitW - 16, Y + 18, admitW, 24).stroke(COLORS.maroon)
  doc.fillColor(COLORS.maroon).text(admit, X + MAIN_W - admitW - 8, Y + 23)

  // Movie
  const left = X + 20
  const textW = MAIN_W - 20 - 140 // room for the QR on the right
  doc.font(FONTS.heading).fontSize(18).fillColor(COLORS.ink).text(t.movieTitle, left, Y + 54, { width: textW, height: 46, ellipsis: true })
  doc.font(FONTS.mono).fontSize(10).fillColor(COLORS.ink).text(t.movieInfo, left, doc.y + 2, { width: textW })

  // Labelled details
  let y = doc.y + 10
  const row = (label, value, font = FONTS.mono) => {
    if (!value) return
    doc.font(FONTS.type).fontSize(8).fillColor(COLORS.label).text(label.toUpperCase(), left, y, { width: textW, characterSpacing: 1 })
    doc.font(font).fontSize(10.5).fillColor(COLORS.ink).text(value, left, doc.y + 1, { width: textW, height: 40, ellipsis: true })
    y = doc.y + 5
  }
  row('Show', t.showText)
  row('Theatre', `${t.theatreName}, ${t.theatreAddress}`)
  row('Screen · Class', `${t.screenName} · ${t.classText}`)
  row(t.admit === 1 ? 'Seat' : 'Seats', t.seatsText, FONTS.monoBold)
  if (t.foodText) row('Food', `${t.foodText}${t.pickupText ? ` · Pickup: ${t.pickupText}` : ''}`)

  // QR + booking number
  const qrSize = 120
  const qrX = X + MAIN_W - qrSize - 16
  const qrY = Y + 70
  doc.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8).fill('#FFFFFF')
  doc.image(qr, qrX, qrY, { width: qrSize, height: qrSize })
  doc.font(FONTS.monoBold).fontSize(11).fillColor(COLORS.ink).text(t.bookingNumber, qrX - 10, qrY + qrSize + 8, { width: qrSize + 20, align: 'center', characterSpacing: 1 })
  doc.font(FONTS.type).fontSize(8).fillColor(COLORS.label).text('Show this QR at the gate', qrX - 10, doc.y + 2, { width: qrSize + 20, align: 'center' })

  // Dotted tear line + counterfoil
  const stubX = X + MAIN_W
  doc.save().lineWidth(1).dash(2, { space: 4 }).moveTo(stubX, Y + 8).lineTo(stubX, Y + H - 8).stroke(COLORS.maroon).restore()
  const stubLeft = stubX + 14
  const stubW = STUB_W - 28
  doc.font(FONTS.heading).fontSize(13).fillColor(COLORS.maroon).text('TALKIES', stubLeft, Y + 20, { width: stubW, align: 'center' })
  const stubRow = (label, value, font, size) => {
    doc.font(FONTS.type).fontSize(8).fillColor(COLORS.label).text(label.toUpperCase(), stubLeft, doc.y + 12, { width: stubW, align: 'center', characterSpacing: 1 })
    doc.font(font).fontSize(size).fillColor(COLORS.ink).text(value, stubLeft, doc.y + 2, { width: stubW, align: 'center' })
  }
  doc.y = Y + 44
  stubRow('Ticket no.', t.bookingNumber, FONTS.monoBold, 10)
  stubRow('Admit', String(t.admit), FONTS.monoBold, 16)
  stubRow('Seats', t.seatsText, FONTS.mono, 9)
  stubRow('Total paid', t.totalText, FONTS.moneyBold, 13)

  // Under the ticket
  doc.font(FONTS.mono).fontSize(9).fillColor(COLORS.ink).text('All times are in IST. The GST invoice is a separate PDF.', X, Y + H + 14, { width: W })

  return toBuffer(doc)
}
