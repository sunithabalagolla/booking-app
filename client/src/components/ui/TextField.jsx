import { useId } from 'react'

// Input with a real label and its error message linked for screen readers (NF-03)
export default function TextField({ label, error, hint, ...inputProps }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-type">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-11 w-full rounded-btn border border-ink bg-cream px-3 py-2 text-ink focus:outline-2 focus:outline-offset-2 focus:outline-maroon aria-invalid:border-maroon aria-invalid:border-2"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-bold text-maroon">
          {error}
        </p>
      )}
    </div>
  )
}
