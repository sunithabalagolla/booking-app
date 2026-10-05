import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useCurrentCity } from '../../api/cities.js'
import { useMovieShows } from '../../api/shows.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { SHOW_FILTERS } from './search.js'
import {
  amenityText,
  dayStrip,
  fromPrice,
  hasAnyShowFilter,
  NO_FILTERED_SHOWS_TEXT,
  NO_SHOWS_TEXT,
  paramsFromShowFilters,
  showApiFilters,
  showFiltersFromParams,
  showTags,
  showTimeText,
} from './showList.js'

// U-09 show list (UI-17) inside the "Show times" section of the movie details page:
// 7 day buttons, SF-08 filter chips, then one paper card per theatre (A to Z) with its
// show times as ticket buttons (stamps sit beside the button, never over the time). A show time opens the seat page /shows/:id (U-10).
// `onPickShow(event, href)` lets the page ask the U-08 age question first.
// "Join waitlist" is hidden until U-22 (decided 2026-10-05): Housefull shows only get the stamp.

// Toggle chip (day buttons + filters): pressed = maroon (Day show) / gold (Night show)
const chipClass =
  'min-h-11 rounded-full border border-(--outline) px-4 font-type text-(--outline) hover:bg-(--outline-hover) focus:outline-2 focus:outline-offset-2 focus:outline-maroon aria-pressed:border-maroon aria-pressed:bg-maroon aria-pressed:text-cream dark:aria-pressed:border-gold dark:aria-pressed:bg-gold dark:aria-pressed:text-ink'

function Chip({ pressed, onClick, children }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={chipClass}>
      {children}
    </button>
  )
}

export default function ShowList({ movie, onPickShow }) {
  const { city, cities, setCity } = useCurrentCity()

  if (cities.isPending) return <p role="status">Loading…</p>
  if (cities.isError) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {cities.error.message}
      </p>
    )
  }
  if (!city) {
    return (
      <div className="space-y-3">
        <p className="font-type">Pick a city to see show times.</p>
        <ul className="flex flex-wrap gap-2">
          {cities.data.map((c) => (
            <li key={c.code}>
              <Chip pressed={false} onClick={() => setCity(c.code)}>
                {c.name}
              </Chip>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return <CityShows movie={movie} city={city} onPickShow={onPickShow} />
}

function CityShows({ movie, city, onPickShow }) {
  const [params, setParams] = useSearchParams()
  const filters = showFiltersFromParams(params, movie.languages)
  const days = dayStrip()

  // Each change starts from the latest address and replaces it (no long Back history)
  const update = useCallback(
    (changes) => setParams((latest) => paramsFromShowFilters({ ...showFiltersFromParams(latest, movie.languages), ...changes }), { replace: true, preventScrollReset: true }),
    [setParams, movie.languages],
  )

  const shows = useMovieShows({ movieId: movie.id, city: city.code, date: filters.date, filters: showApiFilters(filters) })
  const items = shows.data?.items ?? []
  const filtered = hasAnyShowFilter(filters)

  return (
    <div className="min-w-0 space-y-5">
      <p className="font-type">Theatres in {city.name}. Change the city at the top.</p>

      {/* Day strip: today … +6 (scrolls sideways on small phones) */}
      <div role="group" aria-label="Pick a day" className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:thin]">
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            aria-pressed={filters.date === d.day}
            onClick={() => update({ date: d.day })}
            className={`${chipClass} flex shrink-0 flex-col items-center justify-center rounded-card px-3 py-1 leading-tight`}
          >
            <span className="font-bold">{d.name}</span>
            <span className="text-sm">{d.date}</span>
          </button>
        ))}
      </div>

      {/* SF-08 filter chips (one language and one format at a time) */}
      <div role="group" aria-label="Filter shows" className="flex flex-wrap gap-2">
        {movie.languages.length > 1 &&
          movie.languages.map((language) => (
            <Chip key={language} pressed={filters.language === language} onClick={() => update({ language: filters.language === language ? '' : language })}>
              {language}
            </Chip>
          ))}
        {['2D', '3D'].map((format) => (
          <Chip key={format} pressed={filters.format === format} onClick={() => update({ format: filters.format === format ? '' : format })}>
            {format}
          </Chip>
        ))}
        {SHOW_FILTERS.map(({ key, label }) => (
          <Chip key={key} pressed={filters[key]} onClick={() => update({ [key]: !filters[key] })}>
            {label}
          </Chip>
        ))}
        {filtered && (
          <Button variant="secondary" onClick={() => update({ language: '', format: '', subtitles: false, wheelchair: false, parentBaby: false })}>
            Clear filters
          </Button>
        )}
      </div>

      <div aria-busy={shows.isFetching} className={shows.isPlaceholderData ? 'opacity-60' : ''}>
        {shows.isPending && <p role="status">Loading…</p>}
        {shows.isError && (
          <p role="alert" className="font-bold text-(--tone-alert)">
            {shows.error.message}
          </p>
        )}
        {/* UI-44 */}
        {shows.isSuccess && items.length === 0 && (
          <p role="status" className="font-type text-lg">
            {filtered ? NO_FILTERED_SHOWS_TEXT : NO_SHOWS_TEXT}
          </p>
        )}
        {items.length > 0 && (
          <ul aria-label="Theatres" className="space-y-4">
            {items.map(({ theatre, shows: theatreShows }) => (
              <TheatreCard key={theatre.id} theatre={theatre} shows={theatreShows} movie={movie} onPickShow={onPickShow} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function TheatreCard({ theatre, shows, movie, onPickShow }) {
  const amenities = amenityText(theatre.amenities)
  return (
    <Card as="li" className="space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-heading text-xl text-maroon">{theatre.name}</h3>
        <p className="font-type">{fromPrice(shows)}</p>
      </div>
      <div className="-mt-3 text-sm">
        <p>{theatre.address}</p>
        {amenities && <p>{amenities}</p>}
      </div>
      <ul aria-label={`Show times at ${theatre.name}`} className="flex flex-wrap gap-x-3 gap-y-4 pt-1">
        {shows.map((show) => (
          <li key={show.id} className="flex items-center gap-2">
            <ShowTime show={show} movie={movie} onPickShow={onPickShow} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ShowTime({ show, movie, onPickShow }) {
  const tags = showTags(show, movie.languages)
  const inside = (
    <>
      <span className="block">{showTimeText(show)}</span>
      {tags.length > 0 && <span className="block text-xs">{tags.join(' · ')}</span>}
    </>
  )
  const shapeClass = 'ticket-shape flex min-h-11 flex-col justify-center border px-4 py-1.5 font-type leading-snug'

  // Housefull (UI-17): grey, not clickable, small stamp. Join waitlist comes with U-22.
  if (show.housefull) {
    return (
      <>
        <span className={`${shapeClass} border-dashed border-ink/60 text-ink/75`}>{inside}</span>
        <Stamp className="text-[0.7rem]">Housefull</Stamp>
      </>
    )
  }

  const href = `/shows/${show.id}`
  return (
    <>
      <Link
        to={href}
        onClick={(event) => onPickShow(event, href)}
        className="group block rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
      >
        <span className={`${shapeClass} border-ink/60 bg-cream text-ink group-hover:bg-gold`}>{inside}</span>
      </Link>
      {show.deal.active && (
        <Stamp tone="green" className="text-[0.7rem]">
          Special offer
        </Stamp>
      )}
    </>
  )
}
