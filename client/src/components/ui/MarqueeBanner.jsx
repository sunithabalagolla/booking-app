import { movieMeta } from '../../validation/movies.js'
import ButtonLink from './ButtonLink.jsx'
import MarqueeBulbs from './MarqueeBulbs.jsx'
import SepiaPoster from './SepiaPoster.jsx'

// UI-15 marquee banner: maroon box with blinking gold bulb rows top and bottom (UI-14),
// "Now showing" in gold, the movie title, certificate + language, gold "Book tickets".
// The movie's poster sits beside the text on wider screens and above it on phones
// (developer's extra, 2026-10-04). The busiest movie of the city (most shows this week).
export default function MarqueeBanner({ movie }) {
  return (
    <section aria-labelledby="marquee-title" className="group rounded-card border-4 border-gold bg-maroon py-3 text-cream">
      <MarqueeBulbs />
      <div className="flex flex-col items-center gap-5 px-5 py-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="w-40 shrink-0 overflow-hidden rounded-card border-2 border-gold sm:w-44">
          <div className="film-holes" />
          <SepiaPoster src={movie.posterUrl} className="aspect-[2/3]" eager />
          <div className="film-holes" />
        </div>
        <div className="space-y-3 text-center sm:text-left">
          <p className="font-heading text-3xl tracking-wide text-gold">Now showing</p>
          <h2 id="marquee-title" className="font-type text-3xl leading-tight">
            {movie.title}
          </h2>
          <p className="font-type">{movieMeta(movie)}</p>
          <ButtonLink variant="gold" to={`/movies/${movie.id}`} aria-label={`Book tickets for ${movie.title}`}>
            Book tickets
          </ButtonLink>
        </div>
      </div>
      <MarqueeBulbs />
    </section>
  )
}
