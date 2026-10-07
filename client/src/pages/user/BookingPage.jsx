import { useState } from 'react'
import { downloadPdf } from '../../api/bookings.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import BookingGate from './BookingGate.jsx'
import { invoiceFileName, ticketFileName, ticketInfo } from './ticket.js'

// /bookings/:id after paying: UI-27 "Booking confirmed" with the U-17 paper ticket
// (signed QR, SEC-09), ticket PDF + GST invoice PDF downloads.
// The counterfoil tears off (UI-34, CSS .ticket-stub); with reduce motion the full ticket stays.
// Not here yet: Transfer to a friend (SF-02, Phase 9), badge card (U-24, Phase 10).
// A booking that is still a hold goes back to its summary.
export default function BookingPage() {
  return <BookingGate>{(booking) => <BookingView booking={booking} />}</BookingGate>
}

function BookingView({ booking }) {
  if (booking.status === 'pending') {
    return (
      <PaperCard title="Not paid yet">
        <div className="space-y-4">
          <p>Your seats are still held. Finish the payment to book them.</p>
          <ButtonLink to={`/bookings/${booking.id}/summary`}>Back to summary</ButtonLink>
        </div>
      </PaperCard>
    )
  }
  if (booking.status !== 'confirmed') {
    return (
      <PaperCard title="No booking">
        <div className="space-y-4">
          <p>This seat hold ended without a payment, so nothing was booked.</p>
          <ButtonLink to={`/shows/${booking.showId}`}>Pick seats again</ButtonLink>
        </div>
      </PaperCard>
    )
  }

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">Booking confirmed</h1>
        <p>Your ticket is also sent to your email.</p>
      </div>
      <PaperTicket booking={booking} />
      <Downloads booking={booking} />
    </div>
  )
}

function PaperTicket({ booking }) {
  const t = ticketInfo(booking)
  const row = (label, value, strong = false) => (
    <div>
      <dt className="font-type text-xs tracking-widest text-(--tone-mustard) uppercase">{label}</dt>
      <dd className={`font-body ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  )
  return (
    <section aria-label={`Ticket ${booking.bookingNumber}`} className="paper ticket max-w-3xl rounded-card border-2 border-maroon bg-cream text-ink sm:flex">
      {/* Main part */}
      <div className="flex-1 space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="font-heading text-xl text-maroon">TALKIES</p>
          <p className="border-2 border-maroon px-2 py-0.5 font-heading text-maroon">Admit {t.admit}</p>
        </div>
        <div>
          <h2 className="font-heading text-2xl leading-tight">{booking.show.movieTitle}</h2>
          <p className="font-body text-sm">{t.movieInfo}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <dl className="space-y-2">
            {row('Show', t.showText)}
            {row('Theatre', `${booking.show.theatreName}, ${booking.show.theatreAddress}`)}
            {row('Screen · Class', `${booking.show.screenName} · ${t.classText}`)}
            {row(t.seatLabel, t.seatsText, true)}
            {t.foodText && row('Food', t.pickup ? `${t.foodText} · ${t.pickup}` : t.foodText)}
          </dl>
          <div className="flex flex-col items-center gap-1 self-start justify-self-center">
            <img src={booking.qrDataUrl} alt={`QR code of ticket ${booking.bookingNumber}`} width="176" height="176" className="rounded-sm border border-ink bg-white" />
            <p className="font-body text-lg font-bold tracking-widest">{booking.bookingNumber}</p>
            <p className="font-type text-xs">Show this QR at the gate</p>
          </div>
        </div>
      </div>
      {/* Counterfoil: dotted tear line; drops away after 300 ms (UI-34) */}
      <div className="ticket-stub flex flex-row items-center justify-around gap-3 border-t-2 border-dotted border-maroon p-4 text-center sm:w-40 sm:flex-col sm:justify-center sm:border-t-0 sm:border-l-2">
        <p className="font-heading text-maroon">TALKIES</p>
        <div>
          <p className="font-type text-xs tracking-widest text-(--tone-mustard) uppercase">Ticket no.</p>
          <p className="font-body text-sm font-bold">{booking.bookingNumber}</p>
        </div>
        <div>
          <p className="font-type text-xs tracking-widest text-(--tone-mustard) uppercase">Total</p>
          <p className="font-body font-bold">{t.totalText}</p>
        </div>
      </div>
    </section>
  )
}

function Downloads({ booking }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const download = async (key, path, fileName) => {
    setBusy(key)
    setError('')
    try {
      await downloadPdf(path, fileName)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-3">
        <Stamp tone="green">Paid</Stamp>
        <span className="font-body">Total paid {ticketInfo(booking).totalText}</span>
      </p>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy !== null} onClick={() => download('ticket', `/bookings/${booking.id}/ticket.pdf`, ticketFileName(booking))}>
          {busy === 'ticket' ? 'Preparing…' : 'Download ticket'}
        </Button>
        {booking.invoiceId && (
          <Button variant="secondary" disabled={busy !== null} onClick={() => download('invoice', `/invoices/${booking.invoiceId}/pdf`, invoiceFileName(booking))}>
            {busy === 'invoice' ? 'Preparing…' : 'Download GST invoice'}
          </Button>
        )}
        <ButtonLink to="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
      {error && (
        <p role="alert" className="text-(--tone-alert)">
          {error}
        </p>
      )}
    </div>
  )
}
