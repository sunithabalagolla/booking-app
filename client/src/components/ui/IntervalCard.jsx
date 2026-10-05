import { useEffect, useRef } from 'react'
import Button from './Button.jsx'

// UI-33 Interval card: the old "INTERVAL" title card, shown when the seat hold time is
// over (U-12). Native <dialog> (showModal): focus stays inside, the page behind cannot be
// clicked. Fades in 400 ms (`.interval-card` in theme.css; reduce motion: plain fade).
// Escape does the same as the button.
export default function IntervalCard({ open, onPickAgain }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="interval-title"
      aria-describedby="interval-text"
      onCancel={(event) => {
        event.preventDefault()
        onPickAgain()
      }}
      className="interval-card m-auto w-[min(30rem,calc(100vw-2rem))] rounded-card border-4 border-gold bg-stage p-8 text-center text-cream backdrop:bg-stage/85"
    >
      <p aria-hidden="true" className="font-type text-sm tracking-[0.4em] text-gold">
        ✦ ✦ ✦
      </p>
      <h2 id="interval-title" className="my-3 font-heading text-[3rem] leading-none tracking-[0.15em] text-gold sm:text-[4rem]">
        INTERVAL
      </h2>
      <p id="interval-text" className="font-type text-lg">
        Your seat hold time is over. Seats are released.
      </p>
      <div className="mt-6 flex justify-center">
        <Button variant="gold" onClick={onPickAgain} autoFocus>
          Pick seats again
        </Button>
      </div>
    </dialog>
  )
}
