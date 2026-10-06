import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSetFood } from '../../api/bookings.js'
import { useCanteenMenu } from '../../api/theatres.js'
import Button from '../../components/ui/Button.jsx'
import VegMark from '../../components/ui/VegMark.jsx'
import { formatRupees } from '../../validation/food.js'
import { bookingShowText, cartFromBooking, cartLines, changeQty, DEFAULT_PICKUP, foodTotal, itemCountText, PICKUPS } from './food.js'
import HoldTimer from './HoldTimer.jsx'
import BookingGate from './BookingGate.jsx'
import useHoldEnd from './useHoldEnd.jsx'
import { sortSeatIds } from './seats.js'

// U-13 food and snacks at /bookings/:id/food, after the seats are held (9.2).
// UI-24 canteen chalkboard: photo, veg / non-veg mark, price, + / −. Food is optional.
// Pickup "Before movie" / "Interval" (SF-06) shows once food is added (Before movie
// is picked first). The hold timer keeps running; time over = Interval card (UI-33).
// "Continue" / "Skip food" save the food list on the server (prices from the server)
// and open the booking summary (U-14).
export default function FoodPage() {
  return <BookingGate>{(booking, fetchedAt) => <Canteen key={booking.id} booking={booking} fetchedAt={fetchedAt} />}</BookingGate>
}

function Canteen({ booking, fetchedAt }) {
  const navigate = useNavigate()
  const menu = useCanteenMenu(booking.theatreId)
  const setFood = useSetFood(booking.id)
  const { timeUp, endNow, onTimeUp, intervalCard } = useHoldEnd(booking)
  const [cart, setCart] = useState(() => cartFromBooking(booking.food))
  const [pickup, setPickup] = useState(booking.foodPickup ?? DEFAULT_PICKUP)
  const [message, setMessage] = useState(null)

  const items = menu.data?.items ?? []
  const max = menu.data?.maxQtyPerItem ?? 10
  const lines = cartLines(cart, items)
  const foodPaise = foodTotal(cart, items)
  const seatsLink = `/shows/${booking.showId}`

  function change(itemId, delta) {
    setMessage(null)
    setCart((current) => changeQty(current, itemId, delta, max))
  }

  // Continue (with the cart) or Skip food (empty list): the server checks stock + prices
  function save(withFood) {
    const body = withFood && lines.length ? { items: lines, pickup } : { items: [] }
    if (!withFood) setCart({})
    setFood.mutate(body, {
      onSuccess: () => navigate(`/bookings/${booking.id}/summary`),
      onError: (error) => {
        if (error.details?.reason === 'hold_over') endNow()
        else setMessage(error.message)
        if (error.details?.reason === 'sold_out') menu.refetch() // show the new stock
      },
    })
  }

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1">
        <Link to={seatsLink} className="inline-flex min-h-11 items-center font-type underline">
          ← Back to seats
        </Link>
        <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">Canteen</h1>
        <p className="font-type text-lg">
          {booking.show.movieTitle} · {bookingShowText(booking.show)}
        </p>
        <p className="text-sm">Seats {sortSeatIds(booking.seats.map((s) => s.seatId)).join(', ')} · Food is optional.</p>
      </header>

      <section aria-labelledby="menu-title" className="chalkboard px-4 py-5 sm:px-8 sm:py-7">
        <h2 id="menu-title" className="chalk text-center font-heading text-2xl tracking-[0.15em] sm:text-3xl">
          ✦ TODAY&apos;S MENU ✦
        </h2>
        <p className="chalk mb-4 text-center font-type text-sm">{menu.data?.theatre.name ?? booking.show.theatreName}</p>

        {menu.isPending && <p role="status" className="chalk py-6 text-center">Loading menu…</p>}
        {menu.isError && (
          <p role="alert" className="py-6 text-center font-bold text-gold">
            {menu.error.message}
          </p>
        )}
        {menu.isSuccess && items.length === 0 && <p className="chalk py-8 text-center font-type text-lg">The canteen is closed for now.</p>}
        {items.length > 0 && (
          <ul>
            {items.map((item) => (
              <MenuItem key={item.id} item={item} qty={cart[item.id] ?? 0} max={max} onChange={(delta) => change(item.id, delta)} />
            ))}
          </ul>
        )}

        {/* SF-06 pickup time: only with food */}
        {lines.length > 0 && (
          <fieldset className="mt-5">
            <legend className="chalk mb-2 font-type font-bold">When do you want to pick up your food?</legend>
            <div className="flex flex-wrap gap-3">
              {PICKUPS.map((p) => (
                <label key={p.value} className={`chalk flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border-2 px-4 font-type ${pickup === p.value ? 'border-gold' : 'border-cream/40'}`}>
                  <input
                    type="radio"
                    name="pickup"
                    value={p.value}
                    checked={pickup === p.value}
                    onChange={() => setPickup(p.value)}
                    className="h-4 w-4 accent-gold"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      {/* Bottom bar: totals, hold timer, Skip food / Continue */}
      <div className="paper sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-card border border-ink bg-cream-light px-4 py-3 text-ink shadow-[0_-6px_16px_rgb(0_0_0/0.25)]">
        <div aria-live="polite">
          <p className="font-type font-bold">{itemCountText(cart, items)}</p>
          <p className="text-sm">
            Tickets {formatRupees(booking.pricing.ticketsPaise)} · Food {formatRupees(foodPaise)}
          </p>
          {message && <p className="text-sm font-bold text-maroon">{message}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {booking.status === 'pending' && <HoldTimer key={`${booking.id}-${fetchedAt}`} remainingSeconds={booking.remainingSeconds} fetchedAt={fetchedAt} onTimeUp={onTimeUp} />}
          <Button variant="secondary" onClick={() => save(false)} disabled={setFood.isPending || timeUp}>
            Skip food
          </Button>
          <Button onClick={() => save(true)} disabled={setFood.isPending || timeUp || lines.length === 0}>
            {setFood.isPending ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </div>

      {intervalCard}
    </div>
  )
}

// One chalkboard line: photo, name + veg mark (+ Combo), chalk price, − qty +
function MenuItem({ item, qty, max, onChange }) {
  const soldOut = !item.inStock
  return (
    <li className={`chalk-rule flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap sm:gap-4 ${soldOut ? 'opacity-60' : ''}`}>
      {item.photoUrl ? (
        <img src={item.photoUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded border-2 border-cream/60 bg-cream object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded border-2 border-dashed border-cream/50 text-2xl">
          ✦
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`chalk font-type text-lg leading-tight ${soldOut ? 'line-through' : ''}`}>{item.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-cream px-1.5 py-0.5 text-ink">
            <VegMark isVeg={item.isVeg} />
          </span>
          {item.isCombo && <span className="chalk rounded border border-gold px-1.5 font-type text-xs tracking-widest text-gold uppercase">Combo</span>}
          {soldOut && <span className="chalk font-type font-bold">Sold out</span>}
        </p>
      </div>
      <p className="chalk-price w-20 shrink-0 text-right font-type text-xl font-bold">{formatRupees(item.pricePaise)}</p>
      {!soldOut && (
        <div className="flex shrink-0 items-center gap-2" role="group" aria-label={`${item.name} quantity`}>
          <button type="button" className="chalk-btn" onClick={() => onChange(-1)} disabled={qty === 0} aria-label={`One less ${item.name}`}>
            −
          </button>
          <span className="chalk w-7 text-center font-type text-xl font-bold tabular-nums" aria-live="polite">
            {qty}
          </span>
          <button type="button" className="chalk-btn" onClick={() => onChange(+1)} disabled={qty >= max} aria-label={`One more ${item.name}`}>
            +
          </button>
        </div>
      )}
    </li>
  )
}
