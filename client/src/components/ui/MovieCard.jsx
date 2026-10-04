import { Link } from 'react-router'
import { movieMeta } from '../../validation/movies.js'
import SepiaPoster from './SepiaPoster.jsx'

// UI-15 movie card: poster in a film strip (sprocket holes top and bottom), sepia
// until hover / scroll into view (UI-46), then title and certificate + languages.
// The whole card is one link to the movie (U-07). `note` = extra line (e.g. release day).
export default function MovieCard({ movie, note, className = '' }) {
  return (
    <Link
      to={`/movies/${movie.id}`}
      className={`group block rounded-card focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon dark:focus-visible:outline-gold ${className}`}
    >
      <div className="overflow-hidden rounded-card border border-ink dark:border-cream-light">
        <div className="film-holes" />
        <SepiaPoster src={movie.posterUrl} className="aspect-[2/3]" />
        <div className="film-holes" />
      </div>
      <p className="mt-2 font-type text-lg leading-tight group-hover:underline">{movie.title}</p>
      <p className="text-sm">{movieMeta(movie)}</p>
      {note && <p className="text-sm font-bold">{note}</p>}
    </Link>
  )
}
