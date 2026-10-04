import { useCallback, useId, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useCurrentCity } from '../../api/cities.js'
import { useMovies } from '../../api/movies.js'
import Button from '../../components/ui/Button.jsx'
import CheckboxGroup from '../../components/ui/CheckboxGroup.jsx'
import CityChooser from '../../components/ui/CityChooser.jsx'
import MovieCard from '../../components/ui/MovieCard.jsx'
import { GENRES, LANGUAGES } from '../../config/movieOptions.js'
import { releaseLabel } from '../../validation/movies.js'
import { istToday } from '../../validation/shows.js'
import {
  activeFilterCount,
  apiQuery,
  EMPTY_FILTERS,
  filtersFromParams,
  hasShowFilter,
  NO_RESULTS_TEXT,
  paramsFromFilters,
  SEARCH_LIMIT,
  SHOW_FILTERS,
} from './search.js'

// U-06 search + filters (SF-08) at /movies. Filters live in the page address;
// the search text comes from the header search box (UI-15).
// Phones: filters fold into a "Filters (n)" panel; laptops: a column on the left.

export default function SearchPage() {
  const { city, cities, setCity } = useCurrentCity()

  if (cities.isPending) return <p role="status">Loading…</p>
  if (cities.isError) {
    return (
      <p role="alert" className="py-6 font-bold text-(--tone-alert)">
        {cities.error.message}
      </p>
    )
  }
  if (!city) {
    return (
      <div className="py-6">
        <CityChooser cities={cities.data} onPick={setCity} />
      </div>
    )
  }
  return <CitySearch city={city} />
}

function CitySearch({ city }) {
  const [params, setParams] = useSearchParams()
  const filters = filtersFromParams(params)
  const [panelOpen, setPanelOpen] = useState(false)
  const panelId = useId()

  // Each change starts from the latest address and replaces it (no long Back history
  // while ticking boxes)
  const update = useCallback(
    (changes) => setParams((latest) => paramsFromFilters({ ...filtersFromParams(latest), ...changes }), { replace: true }),
    [setParams],
  )

  const query = apiQuery(filters)
  const showFilterOn = hasShowFilter(filters)
  const nowShowing = useMovies({ city: city.code, status: 'now_showing', limit: SEARCH_LIMIT, filters: query })
  const comingSoon = useMovies({ city: city.code, status: 'coming_soon', limit: SEARCH_LIMIT, filters: query, enabled: !showFilterOn })
  const count = activeFilterCount(filters)
  const today = istToday()

  const nowItems = nowShowing.data?.items ?? []
  const soonItems = showFilterOn ? [] : (comingSoon.data?.items ?? [])
  const loading = nowShowing.isPending || (!showFilterOn && comingSoon.isPending)
  const error = nowShowing.error ?? (showFilterOn ? null : comingSoon.error)
  const nothing = !loading && !error && nowItems.length === 0 && soonItems.length === 0

  return (
    <div className="space-y-6 py-6">
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">Find a movie in {city.name}</h1>

      {/* The search box is in the header (UI-15); it drives this page */}
      {filters.q && (
        <p className="font-type">
          Results for “{filters.q}”
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8">
        {/* Filters */}
        <div>
          <Button variant="secondary" className="lg:hidden" aria-expanded={panelOpen} aria-controls={panelId} onClick={() => setPanelOpen((o) => !o)}>
            Filters{count > 0 ? ` (${count})` : ''} {panelOpen ? '▴' : '▾'}
          </Button>
          <section id={panelId} aria-label="Filters" className={`${panelOpen ? 'block' : 'hidden'} mt-4 space-y-5 lg:mt-0 lg:block`}>
            <CheckboxGroup legend="Language" options={LANGUAGES} value={filters.language} onChange={(language) => update({ language })} />
            <CheckboxGroup legend="Genre" options={GENRES} value={filters.genre} onChange={(genre) => update({ genre })} />
            <fieldset className="space-y-1">
              <legend className="font-type">Format</legend>
              <div className="flex flex-wrap gap-x-4">
                {[
                  ['', 'Any'],
                  ['2D', '2D'],
                  ['3D', '3D'],
                ].map(([value, label]) => (
                  <label key={label} className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                    <input type="radio" name="format" checked={filters.format === value} onChange={() => update({ format: value })} className="h-5 w-5 accent-maroon" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-1">
              <legend className="font-type">Special shows</legend>
              {SHOW_FILTERS.map(({ key, label }) => (
                <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={filters[key]} onChange={(e) => update({ [key]: e.target.checked })} className="h-5 w-5 accent-maroon" />
                  {label}
                </label>
              ))}
            </fieldset>
            {(count > 0 || filters.q) && (
              <Button
                variant="secondary"
                onClick={() => setParams(paramsFromFilters(EMPTY_FILTERS), { replace: true })}
              >
                Clear search and filters
              </Button>
            )}
          </section>
        </div>

        {/* Results */}
        <div className="mt-6 space-y-8 lg:mt-0" aria-busy={loading || nowShowing.isFetching}>
          {loading && <p role="status">Loading…</p>}
          {error && (
            <p role="alert" className="font-bold text-(--tone-alert)">
              {error.message}
            </p>
          )}
          {/* UI-44 */}
          {nothing && (
            <p role="status" className="font-type text-lg">
              {NO_RESULTS_TEXT}
            </p>
          )}

          {nowItems.length > 0 && (
            <ResultSection title={`Now showing in ${city.name}`} count={nowItems.length}>
              {nowItems.map((movie) => (
                <li key={movie.id}>
                  <MovieCard movie={movie} />
                </li>
              ))}
            </ResultSection>
          )}
          {soonItems.length > 0 && (
            <ResultSection title="Coming soon" count={soonItems.length}>
              {soonItems.map((movie) => (
                <li key={movie.id}>
                  <MovieCard movie={movie} tag={releaseLabel(movie.releaseDate, today)} />
                </li>
              ))}
            </ResultSection>
          )}
          {showFilterOn && !loading && (
            <p className="text-sm">Coming soon movies have no shows yet, so they are hidden while a format or special show filter is on.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultSection({ title, count, children }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="font-heading text-2xl text-maroon dark:text-gold">
        {title} <span className="font-type text-base">({count})</span>
      </h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">{children}</ul>
    </section>
  )
}
