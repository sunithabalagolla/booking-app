import { useId } from 'react'
import { Link } from 'react-router'
import { useCurrentCity } from '../../api/cities.js'
import { useMovies } from '../../api/movies.js'
import CityChooser from '../../components/ui/CityChooser.jsx'
import MarqueeBanner from '../../components/ui/MarqueeBanner.jsx'
import MovieCard from '../../components/ui/MovieCard.jsx'
import Ticker from '../../components/ui/Ticker.jsx'
import { releaseLabel } from '../../validation/movies.js'
import { istToday } from '../../validation/shows.js'
import { bannerMovie, COMING_SOON_LIMIT, noShowsText, NOW_SHOWING_LIMIT, tickerMessages } from './home.js'

// U-05 Home, "Stage" design (UI-15, docs/home-design.md): first the city (U-04, flow
// 9.2); then the coming soon ticker (UI-26), the hero banner with the city's busiest
// movie, "Now showing in [city]" and "Coming soon". The stage frame and the header
// (with the search box) are in SiteLayout. Later: deals and admin messages in the
// ticker (A-11); bottom navigation when Ticket album + Profile exist.
export default function HomePage() {
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
  return <CityHome key={city.code} city={city} />
}

// Title row: Rye heading + a thin gold line filling the row + ✦ (+ "See all →").
// Phones: the heading may wrap and the line is left out, so nothing sticks out.
function SectionTitle({ id, children, seeAll }) {
  return (
    <div className="flex items-center gap-3">
      <h2 id={id} className="min-w-0 font-heading text-2xl text-maroon sm:shrink-0 sm:text-[2rem] dark:text-gold">
        {children}
      </h2>
      <span aria-hidden="true" className="hidden h-px flex-1 bg-gold/70 sm:block" />
      <span aria-hidden="true" className="ml-auto text-gold sm:ml-0">
        ✦
      </span>
      {seeAll && (
        <Link to={seeAll} className="inline-flex min-h-11 shrink-0 items-center font-type font-bold text-maroon underline dark:text-gold">
          See all →
        </Link>
      )}
    </div>
  )
}

function CityHome({ city }) {
  const nowShowing = useMovies({ city: city.code, status: 'now_showing', limit: NOW_SHOWING_LIMIT })
  const comingSoon = useMovies({ city: city.code, status: 'coming_soon', limit: COMING_SOON_LIMIT })
  const featured = bannerMovie(nowShowing.data?.items ?? [])
  const today = istToday()
  const nowId = useId()
  const soonId = useId()

  return (
    <div className="space-y-10 pb-10">
      <h1 className="sr-only">Movies in {city.name}</h1>

      <Ticker messages={tickerMessages(comingSoon.data?.items ?? [], today)} />

      {featured && <MarqueeBanner movie={featured} city={city} />}

      <section aria-labelledby={nowId} className="space-y-5">
        <SectionTitle id={nowId} seeAll="/movies">
          Now showing in {city.name}
        </SectionTitle>
        <ListState query={nowShowing} empty={noShowsText(city.name)} />
        {nowShowing.data?.items.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {nowShowing.data.items.map((movie, i) => (
              <li key={movie.id}>
                <MovieCard movie={movie} index={i} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={soonId} className="space-y-5">
        <SectionTitle id={soonId}>Coming soon</SectionTitle>
        <ListState query={comingSoon} empty="No new movies announced yet." />
        {comingSoon.data?.items.length > 0 && (
          // A row that scrolls sideways by itself; the page never scrolls sideways
          <ul className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pt-2 pb-3">
            {comingSoon.data.items.map((movie, i) => (
              <li key={movie.id} className="w-40 shrink-0 snap-start sm:w-[190px]">
                <MovieCard movie={movie} index={i} tag={releaseLabel(movie.releaseDate, today)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// Loading / error / empty text for one list
function ListState({ query, empty }) {
  if (query.isPending) return <p role="status">Loading…</p>
  if (query.isError) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {query.error.message}
      </p>
    )
  }
  if (query.data.items.length === 0) return <p className="font-type">{empty}</p>
  return null
}
