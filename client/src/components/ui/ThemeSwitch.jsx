import { useEffect, useId, useRef, useState } from 'react'
import { useThemeStore } from '../../store/themeStore.js'
import { chooseTheme } from '../../theme/themeSync.js'

// UI-02 theme switch: sun/moon icon; tap opens a small menu
// Auto / Day show / Night show, with a tick on the current choice.

const options = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Day show' },
  { value: 'night', label: 'Night show' },
]

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  )
}

// `onDark`: cream outline + gold icon, for the dark sidebar and staff bar
export default function ThemeSwitch({ onDark = false }) {
  const choice = useThemeStore((state) => state.choice)
  const theme = useThemeStore((state) => state.theme)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)
  const menuId = useId()

  // Close when tapping outside or pressing Escape
  useEffect(() => {
    if (!open) return
    function onPointerDown(event) {
      if (!wrapperRef.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function pick(value) {
    chooseTheme(value) // logged in: also saved in the profile
    setOpen(false)
    buttonRef.current.focus()
  }

  const current = options.find((o) => o.value === choice).label
  const showing = theme === 'night' ? 'Night show' : 'Day show'
  const buttonLabel = choice === 'auto' ? `Theme: Auto, ${showing} now` : `Theme: ${current}`

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`flex h-11 w-11 items-center justify-center rounded-btn border ${
          onDark ? 'border-cream text-gold' : 'border-ink text-ink dark:border-cream dark:text-gold'
        }`}
      >
        {theme === 'night' ? <MoonIcon /> : <SunIcon />}
      </button>

      {open && (
        <ul
          id={menuId}
          className="absolute right-0 z-10 mt-2 w-44 rounded-card border border-ink bg-cream-light p-1 text-ink dark:border-cream dark:bg-ink dark:text-cream"
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                aria-pressed={choice === option.value}
                onClick={() => pick(option.value)}
                className="flex min-h-11 w-full items-center gap-2 rounded-btn px-3 text-left font-type hover:bg-cream dark:hover:bg-stage"
              >
                <span className="w-4" aria-hidden="true">
                  {choice === option.value ? '✓' : ''}
                </span>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
