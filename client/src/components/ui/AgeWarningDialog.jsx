import { useEffect, useRef } from 'react'
import Button from './Button.jsx'

// U-08 age warning for "A" movies: an in-page confirm box (not a browser pop-up).
// Uses the native <dialog> (showModal): keyboard focus stays inside, Escape = Go back,
// the page behind cannot be clicked. `open` shows it; onConfirm / onCancel close it.
export default function AgeWarningDialog({ open, movieTitle, onConfirm, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="age-title"
      aria-describedby="age-text"
      // Escape key → the browser fires "cancel"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      className="paper m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card border-4 border-maroon bg-cream p-6 text-ink backdrop:bg-stage/80"
    >
      <p className="stamp mb-3 text-lg text-maroon">Adults only</p>
      <h2 id="age-title" className="font-heading text-2xl text-maroon">
        This movie is for adults 18+
      </h2>
      <p id="age-text" className="mt-2 font-type">
        &quot;{movieTitle}&quot; has an A certificate.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={onConfirm}>Yes, continue</Button>
        <Button variant="secondary" onClick={onCancel} autoFocus>
          Go back
        </Button>
      </div>
    </dialog>
  )
}
