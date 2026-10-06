import { useState } from 'react'
import { Link } from 'react-router'
import { useApplyCoupon, useOffers, useRemoveCoupon } from '../../api/bookings.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { endsText, offerText } from '../../validation/coupons.js'
import { formatRupees } from '../../validation/food.js'
import { bookingShowText } from './food.js'
import HoldTimer from './HoldTimer.jsx'
import BookingGate from './BookingGate.jsx'
import useHoldEnd from './useHoldEnd.jsx'
import { billRows, gstRows, pickupText, signedRupees } from './summary.js'

// U-14 booking summary at /bookings/:id/summary (9.2: after the canteen), UI-23: an old
// bill on ruled paper. Tickets per class, the deal or coupon (U-15), food + pickup time,
// convenience fee, total, and the GST inside it. Every amount comes from the server
// (SEC-10); applying a coupon gives back the new prices. "Pay" opens the payment page (U-16). "Available offers" lists the
// public coupons that work for this booking (added 2026-10-06).
export default function SummaryPage() {
  return <BookingGate>{(booking, fetchedAt) => <Summary key={booking.id} booking={booking} fetchedAt={fetchedAt} />}</BookingGate>
}

function Summary({ booking, fetchedAt }) {
  const { timeUp, endNow, onTimeUp, intervalCard } = useHoldEnd(booking)
  const { pricing } = booking

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1">
        <Link to={`/bookings/${booking.id}/food`} className="inline-flex min-h-11 items-center font-type underline">
          ← Back to canteen
        </Link>
        <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">Booking summary</h1>
        <p className="font-type text-lg">
          {booking.show.movieTitle} · {bookingShowText(booking.show)}
        </p>
        <p className="text-sm">
          {booking.show.screenName} · {booking.show.language} · {booking.show.format}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Bill booking={booking} />
        <div className="space-y-4">
          <CouponBox booking={booking} disabled={timeUp} onHoldOver={endNow} />
          {/* U-15 public offers; none on a deal show (BR-16) */}
          {pricing.discountType !== 'deal' && <AvailableOffers booking={booking} disabled={timeUp} onHoldOver={endNow} />}
        </div>
      </div>

      {/* Bottom bar: total, hold timer, Pay → /bookings/:id/pay (U-16) */}
      <div className="paper sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-card border border-ink bg-cream-light px-4 py-3 text-ink shadow-[0_-6px_16px_rgb(0_0_0/0.25)]">
        <div>
          <p className="font-type text-sm">To pay</p>
          <p className="font-heading text-2xl">{formatRupees(pricing.totalPaise)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {booking.status === 'pending' && <HoldTimer key={`${booking.id}-${fetchedAt}`} remainingSeconds={booking.remainingSeconds} fetchedAt={fetchedAt} onTimeUp={onTimeUp} />}
          <ButtonLink to={`/bookings/${booking.id}/pay`} aria-disabled={timeUp || undefined} className={timeUp ? 'pointer-events-none opacity-60' : ''}>
            Pay {formatRupees(pricing.totalPaise)}
          </ButtonLink>
        </div>
      </div>

      {intervalCard}
    </div>
  )
}

// UI-23: the bill on ruled paper. Lines are GST included; the box below shows the GST inside.
function Bill({ booking }) {
  const { pricing } = booking
  const pickup = pickupText(booking)
  return (
    <section aria-labelledby="bill-title" className="bill-paper rounded-card py-4 pr-4 pl-14 sm:pr-6 sm:pl-16">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bill-title" className="font-heading text-xl tracking-[0.15em] text-maroon">
          BILL
        </h2>
        <p className="font-type text-sm">No. {booking.bookingNumber}</p>
      </div>
      {pricing.discountType === 'deal' && <Stamp className="my-2 text-sm">Special offer</Stamp>}

      <ul className="mt-2">
        {billRows(booking).map((row) => (
          <li key={row.key} className="flex min-h-8 items-start justify-between gap-3 py-1">
            <div className="min-w-0">
              <p className={`font-type ${row.discount ? 'font-bold text-(--tone-green)' : ''}`}>{row.text}</p>
              {row.note && <p className="text-xs">{row.note}</p>}
            </div>
            <p className={`shrink-0 font-type tabular-nums ${row.discount ? 'font-bold text-(--tone-green)' : ''}`}>{signedRupees(row.amountPaise)}</p>
          </li>
        ))}
      </ul>
      {pickup && <p className="py-1 font-type text-sm">{pickup}</p>}

      <p className="bill-total mt-2 flex items-baseline justify-between gap-3 pt-2 font-type text-xl font-bold">
        <span>Total</span>
        <span className="tabular-nums">{formatRupees(pricing.totalPaise)}</span>
      </p>

      {/* GST inside the total (database.md 2a): per kind and rate */}
      <div className="mt-5 rounded border border-dashed border-ink/60 p-3">
        <p className="font-type text-sm font-bold">GST included in the total</p>
        <table className="mt-1 w-full text-left text-xs sm:text-sm">
          <thead>
            <tr>
              <th scope="col" className="py-1 font-normal">
                Item
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                Taxable
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                CGST
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                SGST
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {gstRows(pricing.gstLines).map((row) => (
              <tr key={row.key}>
                <th scope="row" className="py-0.5 font-normal">
                  {row.text}
                </th>
                <td className="py-0.5 text-right">{formatRupees(row.taxablePaise)}</td>
                <td className="py-0.5 text-right">{formatRupees(row.cgstPaise)}</td>
                <td className="py-0.5 text-right">{formatRupees(row.sgstPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// U-15: one coupon per booking, tickets only, not with a Special offer (BR-16)
function CouponBox({ booking, disabled, onHoldOver }) {
  const apply = useApplyCoupon(booking.id)
  const remove = useRemoveCoupon(booking.id)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const { pricing } = booking
  const busy = apply.isPending || remove.isPending

  const onError = (e) => {
    if (e.details?.reason === 'hold_over') onHoldOver()
    else setError(e.message)
  }

  function submit(event) {
    event.preventDefault()
    setError(null)
    if (!code.trim()) {
      setError('Please type a coupon code.')
      return
    }
    apply.mutate(code.trim(), { onSuccess: () => setCode(''), onError })
  }

  return (
    <section aria-labelledby="coupon-title" className="paper space-y-3 rounded-card border border-ink bg-cream-light p-4 text-ink">
      <h2 id="coupon-title" className="font-type text-lg font-bold">
        Coupon
      </h2>
      {pricing.discountType === 'deal' ? (
        <p className="text-sm">This show has a Special offer, so coupons cannot be used.</p>
      ) : pricing.discountType === 'coupon' ? (
        <div className="space-y-2">
          <p className="font-type">
            <span className="font-bold">{pricing.couponCode}</span> applied: <span className="font-bold text-(--tone-green)">−{formatRupees(pricing.ticketDiscountPaise)}</span>
          </p>
          <Button variant="secondary" onClick={() => remove.mutate(undefined, { onError })} disabled={busy || disabled}>
            Remove coupon
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-2">
          <label htmlFor="coupon-code" className="block text-sm">
            Have a coupon code? It works on tickets only.
          </label>
          <div className="flex gap-2">
            <input
              id="coupon-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={30}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'coupon-error' : undefined}
              className="min-h-11 w-full min-w-0 rounded-btn border border-ink bg-cream px-3 py-2 font-type tracking-widest uppercase focus:outline-2 focus:outline-offset-2 focus:outline-maroon aria-invalid:border-2 aria-invalid:border-maroon"
            />
            <Button type="submit" disabled={busy || disabled}>
              {apply.isPending ? 'Checking…' : 'Apply'}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p id="coupon-error" role="alert" className="text-sm font-bold text-maroon">
          {error}
        </p>
      )}
    </section>
  )
}

// U-15 "Available offers" (added 2026-10-06): public coupons that work for this booking,
// biggest saving first, each with "Tap to apply". Hidden when there are none.
function AvailableOffers({ booking, disabled, onHoldOver }) {
  const offers = useOffers(booking.id, { enabled: booking.status === 'pending' })
  const apply = useApplyCoupon(booking.id)
  const [error, setError] = useState(null)

  if (!offers.data?.length) return null

  function tap(code) {
    setError(null)
    apply.mutate(code, {
      onError: (e) => {
        if (e.details?.reason === 'hold_over') onHoldOver()
        else setError(e.message)
      },
    })
  }

  return (
    <section aria-labelledby="offers-title" className="space-y-3">
      <h2 id="offers-title" className="font-type text-lg font-bold">
        Available offers
      </h2>
      <ul className="space-y-3">
        {offers.data.map((offer) => (
          <li key={offer.code} className="paper rounded-card border-2 border-dashed border-maroon bg-cream p-3 text-ink">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-type text-lg font-bold tracking-widest">{offer.code}</p>
                <p className="text-sm">{offerText(offer)}</p>
                <p className="text-xs">{endsText(offer.endAt)}</p>
              </div>
              <p className="shrink-0 font-type font-bold text-(--tone-green)">You save {formatRupees(offer.savingPaise)}</p>
            </div>
            <div className="mt-2">
              {offer.applied ? (
                <Stamp tone="green" className="text-sm">
                  Applied
                </Stamp>
              ) : (
                <Button variant="secondary" onClick={() => tap(offer.code)} disabled={apply.isPending || disabled} aria-label={`Tap to apply ${offer.code}`}>
                  Tap to apply
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm font-bold text-maroon">
          {error}
        </p>
      )}
    </section>
  )
}
