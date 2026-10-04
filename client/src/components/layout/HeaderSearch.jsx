import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { searchHref, withQ } from '../../pages/public/search.js'

// UI-15 header search box (ticket-stub look: cream, dashed dark-mustard border).
// Other pages: Enter opens the Search page (U-06). On the Search page it is the
// search box: results update as you type (after a short pause), filters are kept.
const TYPING_DELAY_MS = 300

function MagnifierIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </svg>
  )
}

export default function HeaderSearch({ id }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const onSearchPage = pathname === '/movies'
  const urlQ = onSearchPage ? (params.get('q') ?? '') : ''

  // Follow the address when it changes from elsewhere (Clear button, Back, leaving the page)
  const [text, setText] = useState(urlQ)
  const [seenQ, setSeenQ] = useState(urlQ)
  if (urlQ !== seenQ) {
    setSeenQ(urlQ)
    setText(urlQ)
  }

  useEffect(() => {
    if (!onSearchPage || text.trim() === urlQ) return
    const timer = setTimeout(() => setParams((latest) => withQ(latest, text), { replace: true }), TYPING_DELAY_MS)
    return () => clearTimeout(timer)
  }, [onSearchPage, text, urlQ, setParams])

  function submit(event) {
    event.preventDefault()
    if (onSearchPage) setParams((latest) => withQ(latest, text), { replace: true })
    else navigate(searchHref(text))
  }

  return (
    <form role="search" onSubmit={submit} className="w-full">
      <label htmlFor={id} className="sr-only">
        Search movies, languages, genres
      </label>
      <div className="flex min-h-11 items-center gap-2 rounded-btn border-2 border-dashed border-mustard bg-cream px-3 text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold">
        <MagnifierIcon />
        <input
          id={id}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search movies, languages, genres…"
          maxLength={100}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent py-2 placeholder:text-ink/80 focus:outline-none"
        />
      </div>
    </form>
  )
}
