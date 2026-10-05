import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMovie } from '../../api/movies.js'
import AgeWarningDialog from '../../components/ui/AgeWarningDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import VintagePoster from '../../components/ui/VintagePoster.jsx'
import { formatDuration, releaseLabel } from '../../validation/movies.js'
import { istToday } from '../../validation/shows.js'
import { CERTIFICATE_TONES, hasAgeOk, needsAgeCheck, ratingText, saveAgeOk } from './movie.js'
import ShowList from './ShowList.jsx'

// U-07 movie details (UI-16) + U-08 age warning, inside the "Stage" frame.
// Book tickets: "A" movies ask first (once per movie per browser visit), then go to
// the show times (U-09 show list). Picking a show time asks too. Reviews come with U-23.
export default function MovieDetailsPage() {
  const { id } = useParams()
  const movie = useMovie(id)

  if (movie.isPending) return <p role="status" className="py-6">Loading…</p>
  if (movie.isError) {
    // UI-36: missing or inactive movie (or a broken link)
    if (['NOT_FOUND', 'VALIDATION_ERROR'].includes(movie.error.code)) {
      return (
        <PaperCard title="Movie not found">
          <div className="space-y-4">
            <p>This reel is missing from the projector room.</p>
            <ButtonLink to="/">Go to home</ButtonLink>
          </div>
        </PaperCard>
      )
    }
    return (
      <p role="alert" className="py-6 font-bold text-(--tone-alert)">
        {movie.error.message}
      </p>
    )
  }
  return <MovieDetails key={id} movie={movie.data} />
}

function InfoChip({ children }) {
  return <li className="rounded-full border border-ink/70 px-3 py-0.5 font-type text-sm dark:border-gold/80">{children}</li>
}

// Small silhouette for cast members without a photo
function Silhouette() {
  return (
    <svg viewBox="0 0 80 100" className="h-full w-full" aria-hidden="true">
      <rect width="80" height="100" fill="#3B2A20" />
      <circle cx="40" cy="38" r="18" fill="#6B4A2E" />
      <path d="M8 100 q4 -34 32 -34 q28 0 32 34 z" fill="#6B4A2E" />
    </svg>
  )
}

function MovieDetails({ movie }) {
  // U-08: where to go after "Yes, continue": 'times' (Book tickets) or a show link. null = closed.
  const [ageNext, setAgeNext] = useState(null)
  const navigate = useNavigate()
  const showTimesRef = useRef(null)
  const today = istToday()
  const comingSoon = movie.status === 'coming_soon'

  function goToShowTimes() {
    showTimesRef.current.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    showTimesRef.current.focus({ preventScroll: true })
  }

  // U-08: "A" movies ask once per movie per visit
  const mustAskAge = () => needsAgeCheck(movie) && !hasAgeOk(movie.id)

  function bookTickets() {
    if (mustAskAge()) setAgeNext('times')
    else goToShowTimes()
  }

  // A show time link: stop it and ask first (the link works normally after a "yes")
  function pickShow(event, href) {
    if (!mustAskAge()) return
    event.preventDefault()
    setAgeNext(href)
  }

  return (
    <article className="space-y-12 py-6">
      {/* Top: poster + facts */}
      <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:gap-12">
        <div className="w-52 shrink-0 overflow-hidden rounded-card border-2 border-gold shadow-[0_10px_24px_rgb(0_0_0/0.45)] sm:w-[280px]">
          <div className="film-holes" />
          <VintagePoster src={movie.posterUrl} alt={`Poster of ${movie.title}`} className="aspect-[2/3]" eager />
          <div className="film-holes" />
        </div>

        <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center gap-4 md:justify-start">
            <h1 className="font-heading text-[2.25rem] leading-tight text-maroon md:text-[3.25rem] dark:text-gold">{movie.title}</h1>
            <Stamp tone={CERTIFICATE_TONES[movie.certificate]} className="text-2xl">
              <span className="sr-only">Certificate </span>
              {movie.certificate}
            </Stamp>
          </div>
          {movie.tagline && <p className="font-type text-xl">{movie.tagline}</p>}

          <ul aria-label="About this movie" className="flex flex-wrap justify-center gap-2 md:justify-start">
            <InfoChip>{movie.languages.join(', ')}</InfoChip>
            <InfoChip>{formatDuration(movie.durationMinutes)}</InfoChip>
            <InfoChip>{movie.genres.join(', ')}</InfoChip>
            {comingSoon && <InfoChip>{releaseLabel(movie.releaseDate, today)}</InfoChip>}
          </ul>

          <p className="font-type text-lg">{ratingText(movie)}</p>

          <div className="flex flex-wrap justify-center gap-3 md:justify-start">
            <Button variant="gold" onClick={bookTickets}>
              Book tickets
            </Button>
            {movie.trailerUrl && (
              <a
                href={movie.trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Watch the trailer of ${movie.title} (opens in a new tab)`}
                className="inline-flex min-h-11 items-center rounded-btn border border-(--outline) px-5 py-2 font-type text-(--outline) hover:bg-(--outline-hover) focus:outline-2 focus:outline-offset-2 focus:outline-maroon"
              >
                ▶ Watch trailer
              </a>
            )}
          </div>
          {needsAgeCheck(movie) && <p className="text-sm">A certificate: for adults 18+.</p>}
        </div>
      </div>

      {/* Cast as small photo cards (UI-16) */}
      {movie.cast.length > 0 && (
        <section aria-labelledby="cast-title" className="space-y-4">
          <h2 id="cast-title" className="font-heading text-2xl text-maroon sm:text-[2rem] dark:text-gold">
            Cast
          </h2>
          <ul className="flex flex-wrap gap-4">
            {movie.cast.map((person) => (
              <li key={person.name} className="w-24 -rotate-1 rounded-sm bg-cream p-1.5 pb-2 text-center text-ink shadow-[0_4px_10px_rgb(0_0_0/0.35)] even:rotate-1">
                <div className="aspect-[4/5] overflow-hidden">
                  {person.photoUrl ? <img src={person.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover sepia-[.35]" /> : <Silhouette />}
                </div>
                <p className="mt-1 font-type text-xs leading-tight">{person.name}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Show times: U-09 show list (UI-17) */}
      <section ref={showTimesRef} tabIndex={-1} aria-labelledby="times-title" className="scroll-mt-6 space-y-3 focus:outline-none">
        <h2 id="times-title" className="font-heading text-2xl text-maroon sm:text-[2rem] dark:text-gold">
          Show times
        </h2>
        {comingSoon && movie.releaseDate > today && <p className="font-type">{releaseLabel(movie.releaseDate, today)}. Shows appear here once theatres add them.</p>}
        <ShowList movie={movie} onPickShow={pickShow} />
      </section>

      {/* Reviews as typewritten notes (UI-16); writing reviews comes with U-23 */}
      <section aria-labelledby="reviews-title" className="space-y-4">
        <h2 id="reviews-title" className="font-heading text-2xl text-maroon sm:text-[2rem] dark:text-gold">
          Reviews
        </h2>
        <p className="paper inline-block -rotate-1 rounded-sm bg-cream-light px-5 py-4 font-type text-ink shadow-[0_4px_10px_rgb(0_0_0/0.3)]">No reviews yet.</p>
      </section>

      <AgeWarningDialog
        open={ageNext !== null}
        movieTitle={movie.title}
        onCancel={() => setAgeNext(null)}
        onConfirm={() => {
          saveAgeOk(movie.id)
          setAgeNext(null)
          if (ageNext === 'times') goToShowTimes()
          else navigate(ageNext)
        }}
      />
    </article>
  )
}
