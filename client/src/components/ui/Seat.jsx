import { SEAT_MARKS } from '../../pages/user/seats.js'

// UI-21 chair seat: backrest, cushion (hinged at its top edge) and 2 wooden armrests.
// Available = cushion folded up, cream. Selected = cushion flips down, gold, tick.
// Booked = maroon, cushion down, ✕. Held = green, cushion up, lock. (NF-04 marks)
// Booked / held are not clickable (aria-disabled, still readable by screen readers).
// Styles: `.seat*` in theme.css (CSS 3D; reduce motion = no flip animation).
export default function Seat({ state, wheelchair, label, onClick }) {
  const taken = state === 'booked' || state === 'held'
  return (
    <button
      type="button"
      className="seat"
      data-state={state}
      aria-label={label}
      aria-pressed={state === 'selected'}
      aria-disabled={taken || undefined}
      onClick={taken ? undefined : onClick}
    >
      <span className="seat-arm seat-arm-left" aria-hidden="true" />
      <span className="seat-back" aria-hidden="true">
        {SEAT_MARKS[state] || (wheelchair ? '♿' : '')}
      </span>
      <span className="seat-cushion" aria-hidden="true" />
      <span className="seat-arm seat-arm-right" aria-hidden="true" />
    </button>
  )
}

// Blocked place (owner set): never bookable, drawn as a dashed outline with a dash
export function BlockedSeat() {
  return (
    <span className="seat-blocked" aria-hidden="true">
      {SEAT_MARKS.blocked}
    </span>
  )
}

// Small seat for the legend (not a button)
export function LegendSeat({ state }) {
  if (state === 'blocked') return <BlockedSeat />
  return (
    <span className="seat" data-state={state} aria-hidden="true">
      <span className="seat-arm seat-arm-left" />
      <span className="seat-back">{SEAT_MARKS[state]}</span>
      <span className="seat-cushion" />
      <span className="seat-arm seat-arm-right" />
    </span>
  )
}
