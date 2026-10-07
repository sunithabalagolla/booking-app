import { useEffect, useRef, useState } from 'react'
import { useCheckIn, useStaffTheatres } from '../../api/staff.js'
import Button from '../../components/ui/Button.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { useAuthStore } from '../../store/authStore.js'
import { motion } from '../../theme/motion.js'
import QrCamera from './QrCamera.jsx'
import { bookingNumberProblem, cleanBookingNumber, rejectionText } from './scan.js'

// S-01 … S-05 gate scanner (UI-31, flow 9.7). Staff open straight here after login, never
// with an intro (UI-10). Camera scan, or "Type booking number" as the backup (S-02).
// The server does all checks (S-03) and marks the ticket used (S-04). The result (S-05):
// green ENTERED or maroon REJECTED stamp (UI-35), then back to scanning after 3 seconds.
export default function StaffScanPage() {
  const user = useAuthStore((s) => s.user)
  const theatres = useStaffTheatres()
  const check = useCheckIn()
  const [result, setResult] = useState(null) // the last answer, shown for 3 s
  const [typing, setTyping] = useState(false)
  const [number, setNumber] = useState('')
  const [numberError, setNumberError] = useState(null)
  const resultRef = useRef(null)

  // S-05: the result screen resets by itself
  useEffect(() => {
    if (!result) return
    resultRef.current?.focus()
    const timer = setTimeout(() => setResult(null), motion.gateReset)
    return () => clearTimeout(timer)
  }, [result])

  const send = (body) =>
    check.mutate(body, {
      onSuccess: (answer) => {
        setResult(answer)
        // A short buzz where phones support it (Android Chrome; iPhone Safari has no vibration)
        navigator.vibrate?.(answer.result === 'entered' ? 120 : [80, 60, 80])
        if (answer.result === 'entered' && body.bookingNumber) setNumber('')
      },
    })

  const submitNumber = (event) => {
    event.preventDefault()
    const problem = bookingNumberProblem(number)
    setNumberError(problem)
    if (!problem) send({ bookingNumber: cleanBookingNumber(number) })
  }

  const busy = check.isPending || result !== null

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      {/* Old ticket window frame (UI-31): wooden arch, cream window */}
      <section aria-labelledby="scanner-title" className="paper rounded-t-[999px] rounded-b-card border-8 border-wood bg-cream-light px-4 pt-14 pb-5 text-ink sm:px-6">
        <h1 id="scanner-title" className="text-center font-heading text-2xl text-maroon">
          Gate scanner
        </h1>
        <p className="mb-4 text-center font-type text-sm">
          {user.name}
          {theatres.data?.length ? ` · ${theatres.data.map((t) => t.name).join(', ')}` : ''}
        </p>

        {result && <ScanResult result={result} ref={resultRef} />}
        {/* Hidden (not removed) during the result, so the camera keeps running */}
        <div hidden={result !== null} className="space-y-4">
          {check.isPending && (
            <p role="status" className="text-center font-type">
              Checking the ticket…
            </p>
          )}
          {check.isError && (
            <p role="alert" className="font-bold text-(--tone-alert)">
              {check.error.message}
            </p>
          )}

          <QrCamera paused={busy} onScan={(qrToken) => send({ qrToken })} />

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
                <Button type="submit" disabled={busy}>
                  Check ticket
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
      </section>
    </div>
  )
}

// S-05 result: big stamp (UI-35) + what the gate needs to see. Announced to screen readers.
function ScanResult({ result, ref }) {
  const entered = result.result === 'entered'
  const b = result.booking
  return (
    <div ref={ref} tabIndex={-1} role="status" className="gate-shake space-y-4 py-2 text-center focus:outline-none">
      <p className={`gate-stamp stamp inline-block text-5xl ${entered ? 'text-(--tone-green)' : 'text-maroon'}`}>{entered ? 'Entered' : 'Rejected'}</p>
      {entered ? (
        <dl className="space-y-1 text-left font-body">
          <Row label="Movie" value={b.movieTitle} big />
          <Row label="Show" value={b.showText} />
          <Row label="Screen" value={b.screenName} />
          <Row label={`Seats (${b.admit})`} value={`${b.classText}: ${b.seatsText}`} big />
          {b.foodText && <Row label="Food" value={`${b.foodText} · pickup: ${b.pickupText}`} />}
          <Row label="Booking" value={b.bookingNumber} />
        </dl>
      ) : (
        <div className="space-y-1">
          <p className="font-type text-xl font-bold">{rejectionText(result)}</p>
          {result.bookingNumber && <p className="font-body text-sm">Booking {result.bookingNumber}</p>}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, big = false }) {
  return (
    <div className="flex gap-3 border-b border-dotted border-ink pb-1">
      <dt className="w-24 shrink-0 font-type text-sm">{label}</dt>
      <dd className={big ? 'text-lg font-bold' : ''}>{value}</dd>
    </div>
  )
}
