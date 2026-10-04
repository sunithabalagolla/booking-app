import { Link } from 'react-router'
import { movieMeta } from '../../validation/movies.js'
import VintagePoster from './VintagePoster.jsx'

// UI-15 movie card ("Stage" design): poster in a film strip (sprocket holes top and
// bottom) with the light vintage tint (UI-46), title, certificate + languages.
// Hover / focus: fully bright and a small lift. The whole card is one link to the
// movie (U-07). `tag` = small cream ticket under it (e.g. "Releases Thu 15 Oct").
// `index` = place in the list, for the rise-in on page load.
export default function MovieCard({ movie, tag, index = 0, className = '' }) {
  return (
    <Link
      to={`/movies/${movie.id}`}
      style={{ '--i': index }}
      className={`rise-in group block rounded-card focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon dark:focus-visible:outline-gold ${className}`}
    >
      <div className="poster-lift overflow-hidden rounded-card border border-ink shadow-[0_6px_14px_rgb(0_0_0/0.35)] dark:border-cream-light">
        <div className="film-holes" />
        <VintagePoster src={movie.posterUrl} className="aspect-[2/3]" />
        <div className="film-holes" />
      </div>
      <p className="mt-2 font-type text-lg leading-tight group-hover:underline">{movie.title}</p>
      <p className="text-sm">{movieMeta(movie)}</p>
      {tag && <p className="ticket-chip mt-2 inline-block px-3 py-0.5 font-type text-sm">{tag}</p>}
    </Link>
  )
}
