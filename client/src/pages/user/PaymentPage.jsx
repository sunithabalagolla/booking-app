import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useGiveUpHold } from '../../api/bookings.js'
import { usePayBooking } from '../../api/payments.js'
import Button from '../../components/ui/Button.jsx'
import FilmReel from '../../components/ui/FilmReel.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { BANKS } from '../../config/payment.js'
import { formatRupees } from '../../validation/food.js'
import BookingGate from './BookingGate.jsx'
import { bookingShowText } from './food.js'
import HoldTimer from './HoldTimer.jsx'
import { EMPTY_PAYMENT, formatCardNumber, formatExpiry, METHODS, paymentErrors, toPaymentFieldErrors } from './payment.js'
import useHoldEnd from './useHoldEnd.jsx'

// U-16 mock payment at /bookings/:id/pay (flow 9.4), UI-25: UPI / Card / Netbanking tabs
// in a paper card. "Processing…" with the film reel (UI-32) for at least 2 s.
// Test values (PAY-03): UPI success@test, card 4111 1111 1111 1111, any bank except
// "Test Bank (fails)". Failure: "Try again" or "Give up seats" (9.4). Success: the
// booking page. The hold timer keeps running; time over = Interval card.
export default function PaymentPage() {
  return <BookingGate>{(booking, fetchedAt) => <Payment key={booking.id} booking={booking} fetchedAt={fetchedAt} />}</BookingGate>
}

function Payment({ booking, fetchedAt }) {
  const navigate = useNavigate()
  const { timeUp, endNow, onTimeUp, intervalCard } = useHoldEnd(booking)
  const pay = usePayBooking(booking.id, booking.showId)
  const giveUp = useGiveUpHold(booking.showId)
  const [method, setMethod] = useState('upi')
  const [form, setForm] = useState(EMPTY_PAYMENT)
  const [errors, setErrors] = useState({})
  const [failed, setFailed] = useState(null) // message after PAYMENT_FAILED (9.4: try again or give up)
  const [message, setMessage] = useState(null)

  // Already paid (e.g. back button): straight to the booking
  if (booking.status === 'confirmed') {
    return (
      <p className="py-6 font-type">
        This booking is already paid.{' '}
        <Link to={`/bookings/${booking.id}`} className="underline">
          See your booking
        </Link>
      </p>
    )
  }

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function submit(event) {
    event.preventDefault()
    setMessage(null)
    const found = paymentErrors(method, form)
    if (Object.keys(found).length) {
      setErrors(found)
      return
    }
    setErrors({})
    pay.mutate(
      { method, form },
      {
        onSuccess: () => navigate(`/bookings/${booking.id}`, { replace: true }),
        onError: (error) => {
          if (error.code === 'PAYMENT_FAILED') setFailed(error.message)
          else if (error.code === 'HOLD_EXPIRED' || error.details?.reason === 'hold_over') {
            setMessage(error.message)
            endNow()
          } else if (error.code === 'VALIDATION_ERROR') setErrors(toPaymentFieldErrors(error.details))
          else setMessage(error.message) // coupon removed, total changed …: the new total shows above
        },
      },
    )
  }

  function giveUpSeats() {
    giveUp.mutate(booking.id, { onSuccess: () => navigate(`/shows/${booking.showId}`, { replace: true }) })
  }

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1">
        <Link to={`/bookings/${booking.id}/summary`} className="inline-flex min-h-11 items-center font-type underline">
          ← Back to summary
        </Link>
        <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">Payment</h1>
        <p className="font-type text-lg">
          {booking.show.movieTitle} · {bookingShowText(booking.show)}
        </p>
      </header>

      <section aria-labelledby="pay-title" className="paper mx-auto max-w-xl rounded-card border border-ink bg-cream-light p-5 text-ink sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="pay-title" className="font-type text-lg font-bold">
            Amount to pay
          </h2>
          <p className="font-heading text-3xl">{formatRupees(booking.pricing.totalPaise)}</p>
        </div>
        <p className="mt-1 text-sm">
          <span className="font-bold">Test payment, no real money.</span> UPI <code>success@test</code> works (<code>fail@test</code> fails). Card{' '}
          <code>4111 1111 1111 1111</code> works. Any bank works except &quot;Test Bank (fails)&quot;.
        </p>

        {pay.isPending ? (
          <div role="status" className="flex flex-col items-center gap-3 py-10">
            <FilmReel />
            <p className="font-type text-lg">Processing…</p>
            <p className="text-sm">Please do not close this page.</p>
          </div>
        ) : failed ? (
          <div role="alert" className="space-y-4 py-6 text-center">
            <p className="font-heading text-2xl text-maroon">Payment failed</p>
            <p>{failed}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => setFailed(null)}>Try again</Button>
              <Button variant="secondary" onClick={giveUpSeats} disabled={giveUp.isPending}>
                Give up seats
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 space-y-4">
            <MethodTabs value={method} onChange={setMethod} />
            <div role="tabpanel" id={`panel-${method}`} aria-labelledby={`tab-${method}`} className="space-y-4 pt-2">
              {method === 'upi' && <TextField label="UPI ID" placeholder="name@bank" autoComplete="off" value={form.upiId} onChange={(e) => set('upiId', e.target.value)} error={errors.upiId} />}
              {method === 'card' && (
                <>
                  <TextField label="Card number" inputMode="numeric" autoComplete="off" value={form.cardNumber} onChange={(e) => set('cardNumber', formatCardNumber(e.target.value))} error={errors.cardNumber} />
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="Expiry (MM/YY)" inputMode="numeric" autoComplete="off" value={form.expiry} onChange={(e) => set('expiry', formatExpiry(e.target.value))} error={errors.expiry} />
                    <TextField label="CVV" inputMode="numeric" autoComplete="off" maxLength={3} value={form.cvv} onChange={(e) => set('cvv', e.target.value.replace(/\D/g, '').slice(0, 3))} error={errors.cvv} />
                  </div>
                  <TextField label="Name on card" autoComplete="off" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
                </>
              )}
              {method === 'netbanking' && (
                <SelectField
                  label="Your bank"
                  placeholder="Pick a bank"
                  options={BANKS.map((b) => ({ value: b.code, label: b.name }))}
                  value={form.bank}
                  onChange={(e) => set('bank', e.target.value)}
                  error={errors.bank}
                />
              )}
            </div>
            {message && (
              <p role="alert" className="font-bold text-maroon">
                {message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={timeUp}>
              Pay {formatRupees(booking.pricing.totalPaise)}
            </Button>
          </form>
        )}
      </section>

      {/* Bottom bar: the same hold timer */}
      <div className="paper sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-card border border-ink bg-cream-light px-4 py-3 text-ink shadow-[0_-6px_16px_rgb(0_0_0/0.25)]">
        <p className="font-type text-sm">Seats are held for you while you pay.</p>
        {booking.status === 'pending' && <HoldTimer key={`${booking.id}-${fetchedAt}`} remainingSeconds={booking.remainingSeconds} fetchedAt={fetchedAt} onTimeUp={onTimeUp} />}
      </div>

      {intervalCard}
    </div>
  )
}

// UPI / Card / Netbanking tabs (UI-25). Arrow keys move between the tabs.
function MethodTabs({ value, onChange }) {
  const refs = useRef({})
  function onKeyDown(event) {
    const i = METHODS.findIndex((m) => m.value === value)
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = METHODS[(i + step + METHODS.length) % METHODS.length].value
    onChange(next)
    refs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label="How do you want to pay?" className="flex border-b-2 border-ink" onKeyDown={onKeyDown}>
      {METHODS.map((m) => {
        const selected = m.value === value
        return (
          <button
            key={m.value}
            ref={(el) => (refs.current[m.value] = el)}
            type="button"
            role="tab"
            id={`tab-${m.value}`}
            aria-selected={selected}
            aria-controls={`panel-${m.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(m.value)}
            className={`-mb-0.5 min-h-11 flex-1 rounded-t-btn border-2 px-3 font-type focus:outline-2 focus:outline-offset-2 focus:outline-maroon ${
              selected ? 'border-ink border-b-cream-light bg-cream-light font-bold' : 'border-transparent text-ink/80 hover:bg-cream'
            }`}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
