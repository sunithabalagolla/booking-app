import { Invoice } from '../models/Invoice.js'
import { User } from '../models/User.js'
import { sendEmail } from './email/index.js'
import { bookingConfirmedTemplate, paymentRefundedTemplate } from './email/templates.js'
import { invoicePdf } from './pdf/invoicePdf.js'
import { ticketPdf } from './pdf/ticketPdf.js'
import { qrPng } from './qr/index.js'
import { istDateTime, rupees, ticketDetails } from './ticketText.js'

// E-03 booking confirmed (Section 12, U-17): ticket details + QR picture inside the email,
// ticket PDF + GST invoice PDF attached. Called after the confirm transaction.

export const ticketFileName = (booking) => `Talkies-ticket-${booking.bookingNumber}.pdf`
export const invoiceFileName = (invoice) => `Talkies-invoice-${invoice.number.replaceAll('/', '-')}.pdf`

export async function sendBookingConfirmedEmail(booking) {
  const [user, invoice] = await Promise.all([User.findById(booking.userId), Invoice.findById(booking.invoiceId)])
  if (!user || !invoice) throw new Error('user or invoice missing')

  const [ticket, invoiceFile, qr] = await Promise.all([ticketPdf(booking), invoicePdf(invoice), qrPng(booking)])
  const qrCid = `qr-${booking.bookingNumber}`
  const { subject, html, text } = bookingConfirmedTemplate({
    name: user.name,
    t: ticketDetails(booking),
    link: `${process.env.CLIENT_URL}/bookings/${booking._id}`,
    qrCid,
    invoiceNumber: invoice.number,
  })
  await sendEmail({
    to: user.email,
    subject,
    html,
    text,
    attachments: [
      { name: `${booking.bookingNumber}-qr.png`, content: qr, contentType: 'image/png', contentId: qrCid },
      { name: ticketFileName(booking), content: ticket, contentType: 'application/pdf' },
      { name: invoiceFileName(invoice), content: invoiceFile, contentType: 'application/pdf' },
    ],
  })
}

// JOB-02: the money came back because the booking could not be kept
export async function sendPaymentRefundedEmail(booking, payment) {
  const user = await User.findById(booking.userId)
  if (!user) throw new Error('user missing')
  const start = istDateTime(booking.show.startAt)
  const { subject, html, text } = paymentRefundedTemplate({
    name: user.name,
    movieTitle: booking.show.movieTitle,
    showText: `${start.day.slice(0, -5)}, ${start.time}`,
    amountText: rupees(payment.amountPaise),
  })
  await sendEmail({ to: user.email, subject, html, text })
}
