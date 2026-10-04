import { useCurrentCity } from '../../api/cities.js'
import { useDropdown } from './useDropdown.js'

// U-04 city picker in the header: "📍 Hyderabad ▾" opens a small list of the
// cities with an approved theatre, with a tick on the current one (like the theme switch).

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export default function CityPicker() {
  const { city, cities, setCity } = useCurrentCity()
  const { open, toggle, close, wrapperRef, buttonRef, menuId } = useDropdown()

  // Nothing to pick from (yet): no button
  if (!cities.data || cities.data.length === 0) return null

  function pick(code) {
    setCity(code)
    close()
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-label={city ? `City: ${city.name}. Change city` : 'Pick your city'}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
        className="flex min-h-11 items-center gap-1 rounded-btn border border-ink px-3 font-type text-ink dark:border-cream dark:text-cream"
      >
        <PinIcon />
        <span className="max-w-32 truncate">{city ? city.name : 'Pick city'}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <ul
          id={menuId}
          aria-label="Cities"
          className="absolute left-0 z-10 mt-2 max-h-80 w-52 overflow-y-auto rounded-card border border-ink bg-cream-light p-1 text-ink dark:border-cream dark:bg-ink dark:text-cream"
        >
          {cities.data.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                aria-pressed={city?.code === c.code}
                onClick={() => pick(c.code)}
                className="flex min-h-11 w-full items-center gap-2 rounded-btn px-3 text-left font-type hover:bg-cream dark:hover:bg-stage"
              >
                <span className="w-4" aria-hidden="true">
                  {city?.code === c.code ? '✓' : ''}
                </span>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
