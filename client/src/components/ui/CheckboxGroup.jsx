import { useId } from 'react'

// A group of checkboxes for picking several items from a fixed list
// (genres, languages; coupon cities and theatres). Each choice is at least 44 px high (16.8).
// options: strings, or { value, label } when the saved value is not the shown text.
export default function CheckboxGroup({ legend, options, value, onChange, error, hint }) {
  const id = useId()
  const errorId = `${id}-error`
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

  function toggle(option) {
    // Keep the order of the fixed list, whatever order they are ticked in
    const next = value.includes(option) ? value.filter((v) => v !== option) : [...value, option]
    onChange(items.map((o) => o.value).filter((v) => next.includes(v)))
  }

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-1">
      <legend className="font-type">{legend}</legend>
      {hint && <p className="text-sm">{hint}</p>}
      <div className="flex flex-wrap gap-x-4">
        {items.map((option) => (
          <label key={option.value} className="inline-flex min-h-11 cursor-pointer items-center gap-2">
            <input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} className="h-5 w-5 accent-maroon" />
            {option.label}
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-sm font-bold text-(--tone-alert)">
          {error}
        </p>
      )}
    </fieldset>
  )
}
