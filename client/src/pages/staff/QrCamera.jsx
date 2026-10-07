import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useEffect, useId, useRef, useState } from 'react'
import Button from '../../components/ui/Button.jsx'

// S-02 phone camera QR scan (html5-qrcode). The camera starts only after a tap (the
// browser asks for permission then) and uses the back camera. While `paused` (a scan is
// being checked or the result shows), codes are ignored.
// Browsers allow the camera only on HTTPS or localhost; otherwise the typed booking
// number is the way in (the message says so).
export default function QrCamera({ paused, onScan }) {
  const id = useId().replace(/:/g, '') // html5-qrcode needs a plain element ID
  const scannerRef = useRef(null)
  const startRef = useRef(null) // the running start(), so stop() waits for it
  const pausedRef = useRef(paused)
  const onScanRef = useRef(onScan)
  const [state, setState] = useState('off') // off · starting · on · error
  const [error, setError] = useState(null)

  useEffect(() => {
    pausedRef.current = paused
    onScanRef.current = onScan
  })

  // Stop the camera when the page closes
  useEffect(() => () => stopCamera(scannerRef, startRef), [])

  const start = async () => {
    setState('starting')
    setError(null)
    const scanner = new Html5Qrcode(`qr-${id}`, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false })
    scannerRef.current = scanner
    startRef.current = scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: (w, h) => ({ width: Math.floor(Math.min(w, h) * 0.75), height: Math.floor(Math.min(w, h) * 0.75) }) },
      (text) => {
        if (!pausedRef.current) onScanRef.current(text)
      },
      () => {}, // "no QR in this frame": normal, ignored
    )
    try {
      await startRef.current
      setState('on')
    } catch (err) {
      scannerRef.current = null
      setState('error')
      setError(cameraErrorText(err))
    }
  }

  return (
    <div className="space-y-3">
      {/* The video goes in here; dark until the camera runs */}
      <div id={`qr-${id}`} className="aspect-square w-full overflow-hidden rounded-card border-4 border-wood bg-stage" aria-label="Camera view" role="img" />
      {state !== 'on' && (
        <Button className="w-full" onClick={start} disabled={state === 'starting'}>
          {state === 'starting' ? 'Starting camera…' : 'Start camera'}
        </Button>
      )}
      {state === 'on' && <p className="font-type text-sm">Hold the ticket QR inside the square.</p>}
      {error && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {error}
        </p>
      )}
    </div>
  )
}

function stopCamera(scannerRef, startRef) {
  const scanner = scannerRef.current
  if (!scanner) return
  scannerRef.current = null
  Promise.resolve(startRef.current)
    .then(() => (scanner.isScanning ? scanner.stop() : null))
    .then(() => scanner.clear())
    .catch(() => {}) // closing anyway
}

function cameraErrorText(err) {
  const text = String(err?.name ?? err ?? '')
  if (!window.isSecureContext) return 'The camera works only on a secure (https) page. Please type the booking number.'
  if (/NotAllowed|Permission/i.test(text)) return 'Camera permission was not given. Allow the camera in the browser settings, or type the booking number.'
  if (/NotFound|Overconstrained|no camera/i.test(text)) return 'No camera found. Please type the booking number.'
  return 'The camera could not start. Please type the booking number.'
}
