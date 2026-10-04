import { useId } from 'react'

// <select> with a real label and its error linked for screen readers (NF-03).
// options: [{ value, label, disabled? }]. `placeholder` adds an empty first choice.
export default function SelectField({ label, error, options, placeholder, ...selectProps }) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-type">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 w-full rounded-btn border border-ink bg-cream px-3 py-2 text-ink focus:outline-2 focus:outline-offset-2 focus:outline-maroon aria-invalid:border-2 aria-invalid:border-maroon"
        {...selectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-sm font-bold text-(--tone-alert)">
          {error}
        </p>
      )}
    </div>
  )
}
