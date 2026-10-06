import { useParams } from 'react-router'
import { useBooking } from '../../api/bookings.js'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'

// Shared by the pages after the seat hold (canteen U-13, summary U-14, payment later):
// loading the booking. The end of the hold time is in useHoldEnd.jsx.

// Loads /bookings/:id and renders children(booking, fetchedAt) once it is there
export default function BookingGate({ children }) {
  const { id } = useParams()
  const booking = useBooking(id)

  if (booking.isPending) return <p role="status" className="py-6">Loading…</p>
  if (booking.isError) {
    const missing = ['NOT_FOUND', 'VALIDATION_ERROR'].includes(booking.error.code)
    return (
      <PaperCard title={missing ? 'Booking not found' : 'Something went wrong'}>
        <div className="space-y-4">
          <p>{missing ? 'We could not find this booking.' : booking.error.message}</p>
          <ButtonLink to="/">Go to home</ButtonLink>
        </div>
      </PaperCard>
    )
  }
  return children(booking.data, booking.dataUpdatedAt)
}
