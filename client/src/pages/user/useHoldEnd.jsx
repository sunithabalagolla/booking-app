import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useGiveUpHold } from '../../api/bookings.js'
import IntervalCard from '../../components/ui/IntervalCard.jsx'

// Hold time over (timer at 0, or the server says hold_over): the Interval card.
// "Pick seats again" goes back to the seat page with a fresh seat list (the cached one
// still has the old hold, whose timer would show the card there again).
export default function useHoldEnd(booking) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const giveUp = useGiveUpHold(booking.showId)
  // A hold that already ended (e.g. an old link) shows the card at once
  const [timeUp, setTimeUp] = useState(booking.status !== 'pending')

  return {
    timeUp,
    endNow: () => setTimeUp(true),
    // Timer at 0: the seats are already free; also mark the booking released
    onTimeUp: () => {
      setTimeUp(true)
      giveUp.mutate(booking.id)
    },
    intervalCard: (
      <IntervalCard
        open={timeUp}
        onPickAgain={() => {
          queryClient.removeQueries({ queryKey: ['show-seats', booking.showId] })
          navigate(`/shows/${booking.showId}`)
        }}
      />
    ),
  }
}
