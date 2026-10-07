import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { downloadPdf } from '../../api/bookings.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import BookingGate from './BookingGate.jsx'
import PaperTicket from './PaperTicket.jsx'
import { invoiceFileName, ticketFileName, ticketInfo } from './ticket.js'

// /bookings/:id after paying: UI-27 "Booking confirmed" with the U-17 paper ticket
// (signed QR, SEC-09), ticket PDF + GST invoice PDF downloads.
// Opened from the ticket album (?from=album, U-18): "Your ticket", no tear-off.
// The counterfoil tears off (UI-34, CSS .ticket-stub); with reduce motion the full ticket stays.
// Not here yet: Transfer to a friend (SF-02, Phase 9), badge card (U-24, Phase 10).
// A booking that is still a hold goes back to its summary.
export default function BookingPage() {
  return <BookingGate>{(booking) => <BookingView booking={booking} />}</BookingGate>
}

function BookingView({ booking }) {
  const [params] = useSearchParams()
  const fromAlbum = params.get('from') === 'album'
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
  if (booking.status === 'cancelled' || booking.status === 'cancelled_by_theatre') {
    return (
      <PaperCard title="Booking cancelled">
        <div className="space-y-4">
          <p>{booking.status === 'cancelled' ? 'You cancelled this booking.' : 'The theatre cancelled this show.'}</p>
          <ButtonLink to="/tickets">Back to ticket album</ButtonLink>
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

  return fromAlbum ? (
    <div className="space-y-6 py-6">
      <div className="space-y-1">
        <Link to="/tickets" className="font-type underline">
          ← Ticket album
        </Link>
        <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">Your ticket</h1>
      </div>
      <PaperTicket booking={booking} />
      <Downloads booking={booking} />
    </div>
  ) : (
    <div className="space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">Booking confirmed</h1>
        <p>Your ticket is also sent to your email.</p>
      </div>
      <PaperTicket booking={booking} tear />
      <Downloads booking={booking} />
    </div>
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
