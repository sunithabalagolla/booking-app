import { useCurrentCity } from '../../api/cities.js'
import { useMovies } from '../../api/movies.js'
import CityChooser from '../../components/ui/CityChooser.jsx'
import MarqueeBanner from '../../components/ui/MarqueeBanner.jsx'
import MovieCard from '../../components/ui/MovieCard.jsx'
import { releaseLabel } from '../../validation/movies.js'
import { istToday } from '../../validation/shows.js'
import { bannerMovie, COMING_SOON_LIMIT, noShowsText, NOW_SHOWING_LIMIT } from './home.js'

// U-05 Home (UI-15): first the city (U-04, flow 9.2), then the marquee banner with the
// city's busiest movie, the "Now showing" grid and the "Coming soon" row.
// Later: ticker strip (UI-26) and admin banners (A-11) in Phase 10; bottom navigation
// when Ticket album + Profile exist.
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

function CityHome({ city }) {
  const nowShowing = useMovies({ city: city.code, status: 'now_showing', limit: NOW_SHOWING_LIMIT })
  const comingSoon = useMovies({ city: city.code, status: 'coming_soon', limit: COMING_SOON_LIMIT })
  const featured = bannerMovie(nowShowing.data?.items ?? [])
  const today = istToday()

  return (
    <div className="space-y-10 py-6">
      <h1 className="sr-only">Movies in {city.name}</h1>

      {featured && <MarqueeBanner movie={featured} />}

      <section aria-labelledby="now-showing" className="space-y-4">
        <h2 id="now-showing" className="font-heading text-3xl text-maroon dark:text-gold">
          Now showing in {city.name}
        </h2>
        <ListState query={nowShowing} empty={noShowsText(city.name)} />
        {nowShowing.data?.items.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {nowShowing.data.items.map((movie) => (
              <li key={movie.id}>
                <MovieCard movie={movie} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="coming-soon" className="space-y-4">
        <h2 id="coming-soon" className="font-heading text-3xl text-maroon dark:text-gold">
          Coming soon
        </h2>
        <ListState query={comingSoon} empty="No new movies announced yet." />
        {comingSoon.data?.items.length > 0 && (
          // A row that scrolls sideways by itself; the page never scrolls sideways
          <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
            {comingSoon.data.items.map((movie) => (
              <li key={movie.id} className="w-32 shrink-0 snap-start sm:w-36">
                <MovieCard movie={movie} note={releaseLabel(movie.releaseDate, today)} />
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
