import { Link } from 'react-router'
import { useMovieShows } from '../../api/shows.js'
import { showChips } from '../../pages/public/home.js'
import { formatDuration } from '../../validation/movies.js'
import { istToday } from '../../validation/shows.js'
import ButtonLink from './ButtonLink.jsx'
import MarqueeBulbs from './MarqueeBulbs.jsx'
import VintagePoster from './VintagePoster.jsx'

// UI-15 hero banner, "Stage" design (docs/home-design.md Section 4): maroon box,
// gold bulbs on all 4 sides chasing round (UI-14), a slow spotlight sweep with dust,
// the city's busiest movie: poster in a film strip, flickering kicker, title, tagline,
// info chips, today's show times in the city ("Tomorrow" when none are left today),
// Book tickets and Watch trailer (only with a trailer link).

const ROW = 18 // bulbs per top / bottom row
const COLUMN = 8 // bulbs per side column
const DUST = [
  { left: '12%', top: '70%', time: '6s', delay: '0s' },
  { left: '24%', top: '55%', time: '7s', delay: '1.5s' },
  { left: '18%', top: '82%', time: '5.5s', delay: '3s' },
  { left: '30%', top: '65%', time: '8s', delay: '2.2s' },
  { left: '8%', top: '60%', time: '6.5s', delay: '4s' },
]

function InfoChip({ children }) {
  return <li className="rounded-full border border-gold/80 px-3 py-0.5 font-type text-sm">{children}</li>
}

function ShowTimes({ movie, city }) {
  const today = istToday()
  const todayShows = useMovieShows({ movieId: movie.id, city: city.code, date: today })
  const todayChips = showChips(todayShows.data?.items ?? [])
  const needTomorrow = todayShows.isSuccess && todayChips.length === 0
  const tomorrowShows = useMovieShows({ movieId: movie.id, city: city.code, date: istToday(1), enabled: needTomorrow })
  const chips = needTomorrow ? showChips(tomorrowShows.data?.items ?? []) : todayChips
  if (chips.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="font-type text-sm tracking-[0.25em] text-[#F2C766]">{needTomorrow ? 'TOMORROW' : 'TODAY'} IN {city.name.toUpperCase()}</p>
      <ul className="flex flex-wrap justify-center gap-2 sm:justify-start">
        {chips.map((chip, i) => (
          <li key={chip.key} className="rise-in" style={{ '--i': i }}>
            <Link to={`/movies/${movie.id}`} className="ticket-chip inline-flex min-h-9 items-center px-3 font-type text-sm hover:bg-gold focus-visible:outline-2 focus-visible:outline-cream">
              {chip.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MarqueeBanner({ movie, city }) {
  return (
    <section aria-labelledby="marquee-title" className="group relative overflow-hidden rounded-[14px] border-[3px] border-gold bg-maroon text-cream">
      {/* Spotlight + dust (decoration) */}
      <div aria-hidden="true" className="spotlight">
        {DUST.map((d, i) => (
          <span key={i} className="dust" style={{ left: d.left, top: d.top, '--dust-time': d.time, '--dust-delay': d.delay }} />
        ))}
      </div>

      {/* Bulbs on all 4 sides: top → right → bottom → left, one round */}
      <MarqueeBulbs count={ROW} offset={0} total={2 * (ROW + COLUMN)} className="pt-2" />
      <div className="flex">
        <MarqueeBulbs vertical count={COLUMN} offset={2 * ROW + COLUMN} total={2 * (ROW + COLUMN)} className="pl-2" />
        <div className="relative m-2 flex-1 rounded-card border border-gold/70 px-4 py-6 sm:px-8">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10">
            <div className="w-44 shrink-0 overflow-hidden rounded-card border-2 border-gold shadow-[0_10px_24px_rgb(0_0_0/0.45)] md:w-[250px]">
              <div className="film-holes" />
              <VintagePoster src={movie.posterUrl} className="aspect-[2/3]" eager />
              <div className="film-holes" />
            </div>
            <div className="min-w-0 space-y-4 text-center md:text-left">
              <p className="neon-flicker font-type text-sm tracking-[0.3em] text-[#F2C766]">✦ NOW SHOWING · MOST SHOWS THIS WEEK ✦</p>
              <h2 id="marquee-title" className="font-heading text-[2.125rem] leading-tight md:text-[3.875rem]">
                {movie.title}
              </h2>
              {movie.tagline && <p className="font-type text-xl">{movie.tagline}</p>}
              <ul aria-label="About this movie" className="flex flex-wrap justify-center gap-2 md:justify-start">
                <InfoChip>{movie.certificate}</InfoChip>
                <InfoChip>{movie.languages.join(', ')}</InfoChip>
                <InfoChip>{formatDuration(movie.durationMinutes)}</InfoChip>
                <InfoChip>{movie.genres.join(', ')}</InfoChip>
              </ul>
              <ShowTimes movie={movie} city={city} />
              <div className="flex flex-wrap justify-center gap-3 pt-1 md:justify-start">
                <ButtonLink variant="gold" to={`/movies/${movie.id}`} aria-label={`Book tickets for ${movie.title}`}>
                  Book tickets
                </ButtonLink>
                {movie.trailerUrl && (
                  <a
                    href={movie.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Watch the trailer of ${movie.title} (opens in a new tab)`}
                    className="inline-flex min-h-11 items-center rounded-btn border border-cream px-5 py-2 font-type hover:bg-stage focus:outline-2 focus:outline-offset-2 focus:outline-cream"
                  >
                    ▶ Watch trailer
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <MarqueeBulbs vertical count={COLUMN} offset={ROW} total={2 * (ROW + COLUMN)} className="pr-2" />
      </div>
      <MarqueeBulbs count={ROW} offset={ROW + COLUMN} total={2 * (ROW + COLUMN)} className="pb-2" />
    </section>
  )
}
