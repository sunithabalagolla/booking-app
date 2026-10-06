import ButtonLink from '../../components/ui/ButtonLink.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { formatRupees } from '../../validation/food.js'
import BookingGate from './BookingGate.jsx'
import { bookingShowText } from './food.js'
import { sortSeatIds } from './seats.js'
import { pickupText } from './summary.js'

// /bookings/:id after paying (U-16). For now a simple "Booking confirmed" page
// (decided 2026-10-06); the full UI-27 paper ticket with QR, PDF and email come with U-17.
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

  const seats = sortSeatIds(booking.seats.map((s) => s.seatId))
  const pickup = pickupText(booking)
  return (
    <div className="space-y-6 py-6">
      <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">Booking confirmed</h1>
      <section aria-label="Your booking" className="paper max-w-xl space-y-3 rounded-card border-2 border-maroon bg-cream p-5 text-ink">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-type">
            Booking number <span className="font-bold tracking-widest">{booking.bookingNumber}</span>
          </p>
          <Stamp tone="green">Paid</Stamp>
        </div>
        <p className="font-heading text-2xl">{booking.show.movieTitle}</p>
        <p className="font-type">{bookingShowText(booking.show)}</p>
        <p className="text-sm">{booking.show.screenName}</p>
        <p className="font-type">
          {seats.length === 1 ? 'Seat' : 'Seats'} {seats.join(', ')}
        </p>
        {booking.food.length > 0 && (
          <p className="text-sm">
            Food: {booking.food.map((f) => `${f.qty} × ${f.name}`).join(', ')}
            {pickup && ` · ${pickup}`}
          </p>
        )}
        <p className="font-type text-lg font-bold">Total paid {formatRupees(booking.pricing.totalPaise)}</p>
        <p className="text-sm">Your ticket with the QR code comes in the next step.</p>
      </section>
      <ButtonLink to="/" variant="secondary">
        Back to home
      </ButtonLink>
    </div>
  )
}
