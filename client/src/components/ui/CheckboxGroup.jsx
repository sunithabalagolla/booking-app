import { useId } from 'react'

// A group of checkboxes for picking several items from a fixed list
// (genres, languages). Each choice is at least 44 px high (16.8).
export default function CheckboxGroup({ legend, options, value, onChange, error }) {
  const id = useId()
  const errorId = `${id}-error`

  function toggle(option) {
    // Keep the order of the fixed list, whatever order they are ticked in
    const next = value.includes(option) ? value.filter((v) => v !== option) : [...value, option]
    onChange(options.filter((o) => next.includes(o)))
  }

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-1">
      <legend className="font-type">{legend}</legend>
      <div className="flex flex-wrap gap-x-4">
        {options.map((option) => (
          <label key={option} className="inline-flex min-h-11 cursor-pointer items-center gap-2">
            <input type="checkbox" checked={value.includes(option)} onChange={() => toggle(option)} className="h-5 w-5 accent-maroon" />
            {option}
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
