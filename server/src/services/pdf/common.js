import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

// Shared parts of the Talkies PDFs (pdfkit): fonts, colours, "make a Buffer".
// Fonts live in server/assets/fonts (licences in docs/credits.md). Only Noto Sans has
// the ₹ sign, so every text with ₹ uses Noto (decided 2026-10-07).

const FONT_DIR = fileURLToPath(new URL('../../../assets/fonts/', import.meta.url))

export const FONTS = {
  heading: 'Rye', // UI-03 headings
  type: 'SpecialElite', // typewriter labels
  mono: 'CourierPrime', // numbers and details
  monoBold: 'CourierPrimeBold',
  money: 'NotoSans', // any text with ₹
  moneyBold: 'NotoSansBold',
}

const FILES = {
  Rye: 'Rye-Regular.ttf',
  SpecialElite: 'SpecialElite-Regular.ttf',
  CourierPrime: 'CourierPrime-Regular.ttf',
  CourierPrimeBold: 'CourierPrime-Bold.ttf',
  NotoSans: 'NotoSans-Regular.ttf',
  NotoSansBold: 'NotoSans-Bold.ttf',
}

// Talkies colours (Section 16.1)
export const COLORS = { cream: '#F3E9D2', maroon: '#7B1E1E', ink: '#3B2A20', gold: '#D9A441', label: '#7D5100', paper: '#FFFDF5' }

export function newDoc(title) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: title, Author: 'Talkies' } })
  for (const [name, file] of Object.entries(FILES)) doc.registerFont(name, FONT_DIR + file)
  return doc
}

// Ends the document and resolves with the whole PDF
export function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}
