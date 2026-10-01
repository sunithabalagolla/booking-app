import { useId, useState } from 'react'
import { usePublicSettings } from '../../api/settings.js'
import { checkImageFile, uploadImage } from '../../api/uploads.js'
import { buttonClass } from './buttonStyles.js'

// Pick an image → it uploads at once (SEC-11) → shows a preview.
// `value` = the saved URL ('' when none). `onChange(url)` gets the new URL ('' when removed).
export default function ImageUpload({ label, kind, value, onChange, error, previewClass = 'h-36 w-24', optional = false }) {
  const id = useId()
  const errorId = `${id}-error`
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const shownError = uploadError ?? error
  const maxMb = usePublicSettings().data?.uploadMaxMb ?? 2 // A-05 setting; the server checks again

  async function pick(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // the same file can be picked again later
    if (!file) return

    const problem = checkImageFile(file, maxMb)
    if (problem) {
      setUploadError(problem)
      return
    }
    setUploadError(null)
    setBusy(true)
    try {
      onChange(await uploadImage(file, kind))
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="font-type" id={`${id}-label`}>
        {label}
        {optional && <span className="text-sm"> (optional)</span>}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {value ? (
          <img src={value} alt={`${label} preview`} className={`${previewClass} rounded-btn border border-ink object-cover`} />
        ) : (
          <div className={`${previewClass} flex items-center justify-center rounded-btn border border-dashed border-ink text-center text-xs`}>
            No image
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {/* The real file input is hidden but still gets keyboard focus; the label is the visible button */}
          <label className={buttonClass('secondary', `focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-maroon ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`)}>
            {busy ? 'Uploading…' : value ? 'Change' : 'Choose image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-labelledby={`${id}-label`}
              aria-describedby={shownError ? errorId : undefined}
              onChange={pick}
              disabled={busy}
            />
          </label>
          {value && optional && (
            <button type="button" className={buttonClass('secondary')} onClick={() => onChange('')}>
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="text-sm">jpg, png or webp, max {maxMb} MB.</p>
      {shownError && (
        <p id={errorId} role="alert" className="text-sm font-bold text-(--tone-alert)">
          {shownError}
        </p>
      )}
    </div>
  )
}
