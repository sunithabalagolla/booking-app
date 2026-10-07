import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { downloadPdf, useCancelBooking, useCancelPreview } from '../../api/bookings.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { formatRupees } from '../../validation/food.js'
import BookingGate from './BookingGate.jsx'
import { creditNoteFileName, cutoffText, istShortDateTime, refundRows } from './cancel.js'
import PaperTicket from './PaperTicket.jsx'
import { invoiceFileName, ticketFileName, ticketInfo } from './ticket.js'

// /bookings/:id after paying: UI-27 "Booking confirmed" with the U-17 paper ticket
// (signed QR, SEC-09), ticket PDF + GST invoice PDF downloads.
// Opened from the ticket album (?from=album, U-18): "Your ticket", no tear-off.
// The counterfoil tears off (UI-34, CSS .ticket-stub); with reduce motion the full ticket stays.
// U-20: "Cancel booking" until the cutoff (BR-04) with the refund shown first (BR-05);
// a cancelled booking shows the refund and the credit note (GST-02).
// Not here yet: Transfer to a friend (SF-02, Phase 9), badge card (U-24, Phase 10).
// A booking that is still a hold goes back to its summary.
export default function BookingPage() {
  return <BookingGate>{(booking) => <BookingView booking={booking} />}</BookingGate>
}

const pageTitle = 'font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold'

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
  if (booking.status === 'cancelled' || booking.status === 'cancelled_by_theatre') return <CancelledView booking={booking} />
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
      {fromAlbum ? (
        <div className="space-y-1">
          <AlbumLink />
          <h1 className={pageTitle}>Your ticket</h1>
        </div>
      ) : (
        <div className="space-y-1">
          <h1 className={pageTitle}>Booking confirmed</h1>
          <p>Your ticket is also sent to your email.</p>
        </div>
      )}
      <PaperTicket booking={booking} tear={!fromAlbum} />
      <Downloads booking={booking} />
      <CancelSection booking={booking} />
    </div>
  )
}

const AlbumLink = () => (
  <Link to="/tickets" className="font-type underline">
    ← Ticket album
  </Link>
)

// PDF downloads through the logged-in API (U-17); one at a time
function useDownload() {
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
  return { busy, error, download }
}

function DownloadError({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="text-(--tone-alert)">
      {error}
    </p>
  )
}

function Downloads({ booking }) {
  const { busy, error, download } = useDownload()
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
      <DownloadError error={error} />
    </div>
  )
}

// U-20: "Cancel booking" → the refund lines (from the server) → "Yes, cancel"
function CancelSection({ booking }) {
  const [open, setOpen] = useState(false)
  const preview = useCancelPreview(booking.id)
  const cancel = useCancelBooking(booking.id)
  const headingRef = useRef(null)
  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open])

  if (preview.isPending || preview.isError) return null
  const p = preview.data
  if (!p.allowed) {
    return <p className="font-type text-sm">Cancellation closed. It was possible until {istShortDateTime(p.cutoffAt)}.</p>
  }
  if (!open) {
    return (
      <div className="space-y-2 border-t border-dotted border-current pt-4">
        <p className="font-type text-sm">{cutoffText(p)}</p>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Cancel booking
        </Button>
      </div>
    )
  }
  return (
    <section aria-labelledby="cancel-title" className="paper bill-paper max-w-xl space-y-4 rounded-card border-2 border-maroon py-5 pr-5 pl-14 text-ink sm:pl-16">
      <h2 id="cancel-title" ref={headingRef} tabIndex={-1} className="font-heading text-xl text-maroon">
        Cancel this booking?
      </h2>
      <table className="w-full font-body text-sm">
        <caption className="sr-only">Refund per line</caption>
        <tbody>
          {refundRows(p).map((r) => (
            <tr key={r.key} className="align-top">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {r.text}
                <span className="block text-xs">{r.note}</span>
              </th>
              <td className="py-1 text-right">{r.amountText}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-4 border-double border-ink">
            <th scope="row" className="pt-2 text-left">
              You get back
            </th>
            <td className="pt-2 text-right text-lg font-bold">{formatRupees(p.refundPaise)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-sm">The money goes back to your payment method. Your seats will be free for others.</p>
      <div className="flex flex-wrap gap-3">
        <Button disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          {cancel.isPending ? 'Cancelling…' : 'Yes, cancel'}
        </Button>
        <Button variant="secondary" disabled={cancel.isPending} onClick={() => setOpen(false)}>
          Keep my booking
        </Button>
      </div>
      {cancel.error && (
        <p role="alert" className="text-(--tone-alert)">
          {cancel.error.message}
        </p>
      )}
    </section>
  )
}

// A cancelled booking (U-20 by the user; O-06 by the theatre later): refund + credit note
function CancelledView({ booking }) {
  const { busy, error, download } = useDownload()
  const t = ticketInfo(booking)
  const c = booking.cancellation
  return (
    <div className="space-y-6 py-6">
      <div className="space-y-1">
        <AlbumLink />
        <h1 className={pageTitle}>Booking cancelled</h1>
      </div>
      <section aria-label={`Ticket ${booking.bookingNumber}`} className="paper relative max-w-xl space-y-1 rounded-card border-2 border-dashed border-maroon bg-cream p-5 text-ink">
        <Stamp tone="maroon" className="absolute top-4 right-4">
          Cancelled
        </Stamp>
        <h2 className="font-heading text-xl leading-tight">{booking.show.movieTitle}</h2>
        <p className="font-body text-sm">{t.showText}</p>
        <p className="font-body text-sm">
          {booking.show.theatreName} · {booking.show.screenName}
        </p>
        <p className="font-body text-sm">
          {t.seatLabel} {t.seatsText} · {booking.bookingNumber}
        </p>
      </section>
      <div className="space-y-2">
        <p>{booking.status === 'cancelled' ? 'You cancelled this booking.' : 'The theatre cancelled this show.'}</p>
        {c && (
          <p className="font-body text-lg">
            Refund <strong>{formatRupees(c.refundPaise)}</strong>
            {c.refundStatus === 'done' ? ' sent back to your payment method.' : ' is on its way to your payment method.'}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {c?.creditNoteId && (
          <Button disabled={busy !== null} onClick={() => download('note', `/invoices/${c.creditNoteId}/pdf`, creditNoteFileName(booking))}>
            {busy === 'note' ? 'Preparing…' : 'Download credit note'}
          </Button>
        )}
        {booking.invoiceId && (
          <Button variant="secondary" disabled={busy !== null} onClick={() => download('invoice', `/invoices/${booking.invoiceId}/pdf`, invoiceFileName(booking))}>
            {busy === 'invoice' ? 'Preparing…' : 'Download GST invoice'}
          </Button>
        )}
        <ButtonLink to="/tickets" variant="secondary">
          Back to ticket album
        </ButtonLink>
      </div>
      <DownloadError error={error} />
    </div>
  )
}
