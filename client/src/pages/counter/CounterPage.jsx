import { useEffect, useRef, useState } from 'react'
import { useFoodCollect, useFoodLookup } from '../../api/foodPickup.js'
import { useStaffTheatres } from '../../api/staff.js'
import Button from '../../components/ui/Button.jsx'
import TextField from '../../components/ui/TextField.jsx'
import VegMark from '../../components/ui/VegMark.jsx'
import { useAuthStore } from '../../store/authStore.js'
import QrCamera from '../staff/QrCamera.jsx'
import { bookingNumberProblem, cleanBookingNumber, gateTime } from '../staff/scan.js'
import { counterRejectionText, itemCountText } from './counter.js'

// O-11 canteen counter (SF-06): scan the ticket QR (or type the booking number) → the food
// order → "Mark collected" (once only, the server decides). Used by the owner (/owner/counter)
// and Gate Staff (/staff/counter). UI-24 chalkboard frame with a cream order slip inside.
// No automatic reset (decided 2026-10-13): "Next order" goes back to scanning.
export default function CounterPage() {
  const user = useAuthStore((s) => s.user)
  const isStaff = user.role === 'staff'
  const theatres = useStaffTheatres({ enabled: isStaff })
  const lookup = useFoodLookup()
  const collect = useFoodCollect()
  const [ticket, setTicket] = useState(null) // the scanned body, sent again by "Mark collected"
  const [answer, setAnswer] = useState(null) // found · collected · rejected
  const [typing, setTyping] = useState(false)
  const [number, setNumber] = useState('')
  const [numberError, setNumberError] = useState(null)
  const answerRef = useRef(null)

  useEffect(() => {
    if (answer) answerRef.current?.focus()
  }, [answer])

  const buzz = (result) => navigator.vibrate?.(result === 'rejected' ? [80, 60, 80] : 120)

  const find = (body) =>
    lookup.mutate(body, {
      onSuccess: (res) => {
        setTicket(body)
        setAnswer(res)
        buzz(res.result)
      },
    })

  const markCollected = () =>
    collect.mutate(ticket, {
      onSuccess: (res) => {
        setAnswer(res)
        buzz(res.result)
      },
    })

  const nextOrder = () => {
    setAnswer(null)
    setTicket(null)
    setNumber('')
    lookup.reset()
    collect.reset()
  }

  const submitNumber = (event) => {
    event.preventDefault()
    const problem = bookingNumberProblem(number)
    setNumberError(problem)
    if (!problem) find({ bookingNumber: cleanBookingNumber(number) })
  }

  const error = lookup.error ?? collect.error

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <section aria-labelledby="counter-title" className="chalkboard px-3 py-5 sm:px-6">
        <h1 id="counter-title" className="chalk text-center font-heading text-2xl tracking-[0.15em]">
          ✦ Canteen counter ✦
        </h1>
        <p className="chalk mb-4 text-center font-type text-sm">
          {user.name}
          {isStaff && theatres.data?.length ? ` · ${theatres.data.map((t) => t.name).join(', ')}` : ''}
        </p>

        {/* The order slip: cream paper on the board */}
        <div className="paper rounded-card bg-cream-light p-4 text-ink">
          {answer && <CounterAnswer answer={answer} ref={answerRef} onCollect={markCollected} collecting={collect.isPending} onNext={nextOrder} />}
          {error && (
            <p role="alert" className="mt-3 font-bold text-maroon">
              {error.message}
            </p>
          )}

          {/* Hidden (not removed) while an order shows, so the camera keeps running */}
          <div hidden={answer !== null} className="space-y-4">
            {lookup.isPending && (
              <p role="status" className="text-center font-type">
                Finding the order…
              </p>
            )}

            <QrCamera paused={lookup.isPending || answer !== null} onScan={(qrToken) => find({ qrToken })} />

            {typing ? (
              <form onSubmit={submitNumber} noValidate className="space-y-3 border-t border-dotted border-ink pt-4">
                <TextField
                  label="Booking number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  error={numberError}
                  hint="TK + 8 letters or numbers, e.g. TK7F3K9QXM"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoFocus
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={lookup.isPending}>
                    Find order
                  </Button>
                  <Button variant="secondary" onClick={() => setTyping(false)}>
                    Close
                  </Button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setTyping(true)} className="block min-h-11 w-full font-type text-lg text-maroon underline">
                Type booking number
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// The order (found / collected) or the reason (rejected). Announced to screen readers.
function CounterAnswer({ answer, ref, onCollect, collecting, onNext }) {
  const { result, order } = answer
  return (
    <div ref={ref} tabIndex={-1} role="status" className="space-y-4 text-center focus:outline-none">
      {result === 'collected' && <p className="gate-stamp stamp inline-block text-5xl text-(--tone-green)">Collected</p>}
      {result === 'rejected' && (
        <div className="gate-shake space-y-2">
          <p className="gate-stamp stamp inline-block text-5xl text-maroon">Rejected</p>
          <p className="font-type text-xl font-bold">{counterRejectionText(answer)}</p>
          {answer.bookingNumber && <p className="font-body text-sm">Booking {answer.bookingNumber}</p>}
        </div>
      )}

      {order && (
        <div className="space-y-3 text-left">
          <p className="text-center font-type text-lg">
            Pickup: <strong className="text-maroon">{order.pickupText}</strong>
          </p>
          <ul aria-label={`Food order, ${itemCountText(order.items)}`} className="divide-y divide-dotted divide-ink border-y border-dotted border-ink">
            {order.items.map((item) => (
              <li key={item.name} className="flex items-center gap-3 py-2">
                <span className="w-12 shrink-0 text-right font-body text-2xl font-bold">{item.qty} ×</span>
                <span className="flex-1 font-type text-lg leading-tight">{item.name}</span>
                <VegMark isVeg={item.isVeg} className="text-sm" />
              </li>
            ))}
          </ul>
          <p className="font-body text-sm">
            {order.movieTitle} · {order.showText}
            <br />
            {order.screenName} · Seats {order.seatsText} · Booking {order.bookingNumber}
          </p>
          {result === 'collected' && <p className="font-type">Collected at {gateTime(answer.collectedAt)}.</p>}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {result === 'found' && (
          <Button onClick={onCollect} disabled={collecting}>
            {collecting ? 'Saving…' : 'Mark collected'}
          </Button>
        )}
        <Button variant={result === 'found' ? 'secondary' : 'primary'} onClick={onNext}>
          {result === 'found' ? 'Cancel' : 'Next order'}
        </Button>
      </div>
    </div>
  )
}
