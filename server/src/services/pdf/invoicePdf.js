import { istDateTime, rupees } from '../ticketText.js'
import { COLORS, FONTS, newDoc, toBuffer } from './common.js'

// 11.3 GST tax invoice PDF (made from the invoices document; nothing is stored).
// Prices include GST: each line shows the taxable value + CGST + SGST worked back.
// Money on the invoice always has 2 decimals.

const X = 40
const W = 515
const BOTTOM = 790 // new page below this

// Table columns: [title, width, align]
const COLUMNS = [
  ['#', 18, 'left'],
  ['Description', 150, 'left'],
  ['HSN/SAC', 62, 'left'],
  ['Qty', 26, 'right'],
  ['Taxable (₹)', 62, 'right'],
  ['GST', 38, 'right'],
  ['CGST (₹)', 52, 'right'],
  ['SGST (₹)', 52, 'right'],
  ['Amount (₹)', 55, 'right'],
]

const amount = (paise) => rupees(paise, { decimals: true }).slice(1) // no ₹: the column title has it

export async function invoicePdf(invoice) {
  const doc = newDoc(`Talkies tax invoice ${invoice.number}`)
  const issued = istDateTime(invoice.issuedAt)

  // Header band
  doc.rect(X, 40, W, 50).fill(COLORS.maroon)
  doc.font(FONTS.heading).fontSize(24).fillColor(COLORS.gold).text('Talkies', X + 16, 52)
  doc.font(FONTS.type).fontSize(16).fillColor(COLORS.cream).text('TAX INVOICE', X, 58, { width: W - 16, align: 'right', characterSpacing: 2 })

  // Invoice facts
  let y = 104
  const fact = (label, value, x) => {
    doc.font(FONTS.type).fontSize(8).fillColor(COLORS.label).text(label.toUpperCase(), x, y, { characterSpacing: 1 })
    doc.font(FONTS.monoBold).fontSize(10.5).fillColor(COLORS.ink).text(value, x, y + 11)
  }
  fact('Invoice no.', invoice.number, X)
  fact('Date', `${issued.day}, ${issued.time} IST`, X + 150)
  fact('Booking no.', invoice.bookingNumber, X + 330)
  fact('Place of supply', invoice.seller.state, X + 430)

  // Parties
  y = 148
  const block = (title, lines, x, width) => {
    doc.font(FONTS.type).fontSize(8).fillColor(COLORS.label).text(title.toUpperCase(), x, y, { width, characterSpacing: 1 })
    doc.font(FONTS.mono).fontSize(9.5).fillColor(COLORS.ink)
    for (const line of lines.filter(Boolean)) doc.text(line, x, doc.y + 1, { width })
    return doc.y
  }
  const colW = (W - 20) / 3
  const ends = [
    block('Seller (tickets and food)', [invoice.seller.theatreName, invoice.seller.address, `GSTIN ${invoice.seller.gstin}`, `State: ${invoice.seller.state}`], X, colW),
    block('Platform (convenience fee)', [invoice.platform?.companyName, invoice.platform?.address, invoice.platform?.gstin && `GSTIN ${invoice.platform.gstin}`], X + colW + 10, colW),
    block('Billed to', [invoice.buyer?.name || '—', invoice.buyer?.email], X + 2 * (colW + 10), colW),
  ]
  y = Math.max(...ends) + 18

  // Table
  const header = () => {
    doc.rect(X, y, W, 20).fill(COLORS.cream)
    let x = X
    for (const [title, width, align] of COLUMNS) {
      doc.font(FONTS.moneyBold).fontSize(8).fillColor(COLORS.ink).text(title, x + 3, y + 5, { width: width - 6, align })
      x += width
    }
    y += 22
  }
  const cells = (values, { bold = false } = {}) => {
    // Row height = the tallest cell (long descriptions wrap)
    doc.font(bold ? FONTS.monoBold : FONTS.mono).fontSize(9)
    const height = Math.max(...values.map((v, i) => doc.heightOfString(String(v), { width: COLUMNS[i][1] - 6 }))) + 8
    if (y + height > BOTTOM) {
      doc.addPage()
      y = 40
      header()
    }
    let x = X
    values.forEach((value, i) => {
      doc.font(bold ? FONTS.monoBold : FONTS.mono).fontSize(9).fillColor(COLORS.ink).text(String(value), x + 3, y + 4, { width: COLUMNS[i][1] - 6, align: COLUMNS[i][2] })
      x += COLUMNS[i][1]
    })
    y += height
    doc.lineWidth(0.4).moveTo(X, y).lineTo(X + W, y).stroke('#B8A88A')
  }
  header()
  invoice.lines.forEach((l, i) => {
    cells([i + 1, l.description, l.hsnSac ?? '—', l.qty, amount(l.taxablePaise), `${l.gstPercent}%`, amount(l.cgstPaise), amount(l.sgstPaise), amount(l.totalPaise)])
  })
  const t = invoice.totals
  cells(['', 'Total', '', '', amount(t.taxablePaise), '', amount(t.cgstPaise), amount(t.sgstPaise), amount(t.totalPaise)], { bold: true })

  // Amount paid
  if (y + 120 > BOTTOM) {
    doc.addPage()
    y = 40
  }
  y += 14
  doc.font(FONTS.moneyBold).fontSize(14).fillColor(COLORS.maroon).text(`Amount paid ${rupees(t.totalPaise, { decimals: true })}`, X, y, { width: W, align: 'right' })
  y = doc.y + 16
  doc.font(FONTS.mono).fontSize(8.5).fillColor(COLORS.ink)
  doc.text(`Prices include GST. The taxable value, CGST and SGST are worked back from each price. Every line has CGST + SGST of ${invoice.seller.state}, each half of the GST rate.`, X, y, { width: W })
  doc.text('This invoice is made by computer and needs no signature.', X, doc.y + 4, { width: W })

  return toBuffer(doc)
}
