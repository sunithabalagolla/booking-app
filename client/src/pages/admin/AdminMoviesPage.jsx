import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAdminMovies } from '../../api/adminMovies.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { MOVIE_STATUSES, STATUS_LABELS, STATUS_TONES } from '../../config/movieOptions.js'
import { formatDay } from '../../validation/movies.js'

// A-02: the admin's movie register (UI-30 ledger look). Search, status filter, pages.
const statusOptions = MOVIE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))

export default function AdminMoviesPage() {
  const location = useLocation()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const movies = useAdminMovies({ q, status, page })
  const data = movies.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">Movies</h1>
        <ButtonLink to="/admin/movies/new">+ Add movie</ButtonLink>
      </div>

      {/* Message from the form after adding / deleting a movie */}
      {location.state?.message && (
        <p role="status" className="font-type">
          {location.state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Search by title"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <SelectField
          label="Status"
          placeholder="All"
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {movies.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {movies.error.message}
        </p>
      )}

      {data && data.items.length === 0 && <p className="font-type">No movies found.</p>}

      {data && data.items.length > 0 && (
        // Register page: column lines, numbers in Courier Prime (UI-30). Wide tables scroll inside the box.
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">Movies, newest release first</caption>
            <thead className="font-type">
              <tr>
                {['Poster', 'Title', 'Cert.', 'Languages', 'Release', 'Status'].map((h) => (
                  <th key={h} scope="col" className="border border-ink px-3 py-2 dark:border-cream-light">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((movie) => (
                <tr key={movie.id}>
                  <td className="border border-ink px-3 py-2 dark:border-cream-light">
                    <img src={movie.posterUrl} alt="" className="h-16 w-11 rounded-btn object-cover" />
                  </td>
                  <td className="border border-ink px-3 py-2 dark:border-cream-light">
                    <Link to={`/admin/movies/${movie.id}`} className="font-type font-bold underline">
                      {movie.title}
                    </Link>
                  </td>
                  <td className="border border-ink px-3 py-2 dark:border-cream-light">{movie.certificate}</td>
                  <td className="border border-ink px-3 py-2 dark:border-cream-light">{movie.languages.join(', ')}</td>
                  <td className="border border-ink px-3 py-2 whitespace-nowrap dark:border-cream-light">{formatDay(movie.releaseDate)}</td>
                  <td className="border border-ink px-3 py-2 dark:border-cream-light">
                    <Stamp tone={STATUS_TONES[movie.status]} className="text-sm whitespace-nowrap">
                      {STATUS_LABELS[movie.status]}
                    </Stamp>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-4 font-type">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {data.page} of {pages}
          </span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  )
}
