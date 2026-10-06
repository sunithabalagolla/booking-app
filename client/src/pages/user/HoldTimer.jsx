import { useEffect, useRef, useState } from 'react'
import { clockWords, formatClock, secondsLeft } from './seats.js'

// U-12 hold timer: "9:41 left". Counts down every second from the server's
// remainingSeconds; at 0 it calls onTimeUp once. Used on the seat page and the canteen.
export default function HoldTimer({ remainingSeconds, fetchedAt, onTimeUp }) {
  const [left, setLeft] = useState(() => secondsLeft(remainingSeconds, fetchedAt))
  const doneRef = useRef(false)
  const onTimeUpRef = useRef(onTimeUp)
  useEffect(() => {
    onTimeUpRef.current = onTimeUp
  })

  useEffect(() => {
    const tick = () => {
      const now = secondsLeft(remainingSeconds, fetchedAt)
      setLeft(now)
      if (now === 0 && !doneRef.current) {
        doneRef.current = true
        onTimeUpRef.current()
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [remainingSeconds, fetchedAt])

  return (
    <p role="timer" aria-label={`Seats held for ${clockWords(left)} more`} className={`font-type text-2xl font-bold tabular-nums ${left <= 60 ? 'text-maroon' : ''}`}>
      {formatClock(left)} <span className="text-sm font-normal">left</span>
    </p>
  )
}
