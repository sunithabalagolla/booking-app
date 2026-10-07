import { useEffect, useId, useRef, useState } from 'react'
import { useCancelShow, useShowCancelPreview } from '../../api/ownerShows.js'
import Button from '../../components/ui/Button.jsx'
import { formatShortDay, formatTime12, SHOW_LABEL_NAMES } from '../../validation/shows.js'
import { cancelSummaryText, REASON_MAX, reasonProblem } from './showCancel.js'

// O-06: "Cancel show" panel under the show's row: what goes back (BR-06), reason, confirm.
// The refunds and E-05 emails are sent by the server (JOB-04) after the cancel.
export default function CancelShowPanel({ show, onClose, onCancelled }) {
  const preview = useShowCancelPreview(show.id)
  const cancel = useCancelShow(show.id)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(null)
  const headingRef = useRef(null)
  const id = useId()

  useEffect(() => headingRef.current?.focus(), []) // keyboard and screen reader users land on the panel

  const submit = (event) => {
    event.preventDefault()
    const problem = reasonProblem(reason)
    setReasonError(problem)
    if (problem) return
    cancel.mutate(
      { reason: reason.trim() },
      {
        onSuccess: (result) => onCancelled(result),
        onError: (err) => setReasonError(err.details?.reason ?? null),
      },
    )
  }

  return (
    <section aria-labelledby={`${id}-title`} className="paper max-w-2xl space-y-4 rounded-card border-2 border-maroon bg-cream p-5 text-ink">
      <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="font-heading text-xl text-maroon">
        Cancel this show?
      </h2>
      <p className="font-type">
        {show.movie.title} · {SHOW_LABEL_NAMES[show.label]} · {formatShortDay(show.date)}, {formatTime12(show.startTime)} · {show.screen.name}
      </p>

      {preview.isPending && <p role="status">Counting the bookings…</p>}
      {preview.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {preview.error.message}
        </p>
      )}
      {preview.data && <p className="font-body text-lg font-bold">{cancelSummaryText(preview.data)}</p>}

      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1">
          <label htmlFor={`${id}-reason`} className="block font-type">
            Reason (sent to every user who booked)
          </label>
          <textarea
            id={`${id}-reason`}
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={`${id}-hint${reasonError ? ` ${id}-error` : ''}`}
            className="w-full rounded-btn border border-ink bg-cream px-3 py-2 text-ink focus:outline-2 focus:outline-offset-2 focus:outline-maroon aria-invalid:border-2 aria-invalid:border-maroon"
          />
          <p id={`${id}-hint`} className="text-sm">
            5 to {REASON_MAX} characters. This cannot be undone.
          </p>
          {reasonError && (
            <p id={`${id}-error`} className="text-sm font-bold text-(--tone-alert)">
              {reasonError}
            </p>
          )}
        </div>
        {cancel.isError && !reasonError && (
          <p role="alert" className="font-bold text-(--tone-alert)">
            {cancel.error.message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={cancel.isPending || !preview.data}>
            {cancel.isPending ? 'Cancelling…' : 'Yes, cancel show'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={cancel.isPending}>
            Keep the show
          </Button>
        </div>
      </form>
    </section>
  )
}
