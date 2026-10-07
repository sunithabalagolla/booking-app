import { Fragment, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useMyShows } from '../../api/ownerShows.js'
import { useTheatreScreens } from '../../api/ownerScreens.js'
import { useMyTheatres } from '../../api/ownerTheatres.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { formatRupees } from '../../validation/food.js'
import { CLASS_NAMES, formatShortDay, formatTime12, istToday, SHOW_LABEL_NAMES } from '../../validation/shows.js'
import CancelShowPanel from './CancelShowPanel.jsx'
import { canCancelShow, cancelledMessage } from './showCancel.js'

// O-05: my shows, 7 days at a time, grouped by day (UI-30 register look). O-06: Cancel show.
const cell = 'border border-ink px-3 py-2 align-top dark:border-cream-light'
const PAGE_SIZE = 100
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

export default function OwnerShowsPage() {
  const location = useLocation()
  const theatres = useMyTheatres()
  const [filters, setFilters] = useState({ theatreId: '', screenId: '', from: istToday(), page: 1 })
  const screens = useTheatreScreens(filters.theatreId)
  const to = addDays(filters.from, 6)
  const shows = useMyShows({ ...filters, to, limit: PAGE_SIZE })

  const set = (changes) => setFilters((f) => ({ ...f, page: 1, ...changes }))
  const pages = shows.data ? Math.max(1, Math.ceil(shows.data.total / PAGE_SIZE)) : 1
  const days = groupByDay(shows.data?.items ?? [])
  const [now] = useState(() => Date.now()) // page open time: decides which shows can still be edited
  const [cancelling, setCancelling] = useState(null) // show ID with the open O-06 panel
  const [message, setMessage] = useState(location.state?.message ?? null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">Shows</h1>
        <ButtonLink to="/owner/shows/new">+ New show</ButtonLink>
      </div>

      {message && (
        <p role="status" className="font-type">
          {message}
        </p>
      )}

      {/* Filters */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Theatre"
          options={[{ value: '', label: 'All theatres' }, ...(theatres.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
          value={filters.theatreId}
          onChange={(e) => set({ theatreId: e.target.value, screenId: '' })}
        />
        <SelectField
          label="Screen"
          options={[{ value: '', label: 'All screens' }, ...(screens.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          value={filters.screenId}
          onChange={(e) => set({ screenId: e.target.value })}
          disabled={!filters.theatreId}
        />
        <TextField label="From" type="date" value={filters.from} onChange={(e) => e.target.value && set({ from: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => set({ from: addDays(filters.from, -7) })}>
          ← Previous 7 days
        </Button>
        <p className="font-type">
          {formatShortDay(filters.from)} – {formatShortDay(to)}
        </p>
        <Button variant="secondary" onClick={() => set({ from: addDays(filters.from, 7) })}>
          Next 7 days →
        </Button>
      </div>

      {shows.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {shows.error.message}
        </p>
      )}
      {shows.isPending && <p role="status">Loading…</p>}

      {/* UI-44 empty state */}
      {shows.data?.items.length === 0 && <p className="font-type">Your screen is dark. Add your first show.</p>}

      {days.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">Shows from {formatShortDay(filters.from)} to {formatShortDay(to)}</caption>
            <thead className="font-type">
              <tr>
                {['Time', 'Movie', 'Theatre · Screen', 'Language', 'Extras', 'Prices', 'Seats sold', ''].map((h, i) => (
                  <th key={i} scope="col" className={cell}>
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(([day, items]) => (
                <Fragment key={day}>
                  <tr>
                    <th colSpan={8} scope="rowgroup" className={`${cell} bg-cream-light font-type text-lg text-ink`}>
                      {formatShortDay(day)}
                    </th>
                  </tr>
                  {items.map((show) => [
                    <tr key={show.id}>
                      <td className={`${cell} whitespace-nowrap`}>
                        <span className="font-type">{SHOW_LABEL_NAMES[show.label]}</span> · {formatTime12(show.startTime)}
                        <br />
                        <span className="text-sm">ends {formatTime12(show.endTime)}</span>
                      </td>
                      <td className={cell}>
                        <span className="font-type font-bold">{show.movie.title}</span> ({show.movie.certificate})
                      </td>
                      <td className={cell}>
                        {show.theatre.name} · {show.screen.name}
                      </td>
                      <td className={cell}>
                        {show.language} · {show.format}
                      </td>
                      <td className={`${cell} text-sm`}>
                        <ul>
                          {show.subtitles && <li>Subtitles</li>}
                          {show.tags.includes('parent_baby') && <li>Parent-and-baby</li>}
                          {show.wheelchairFriendly && <li>Wheelchair-friendly</li>}
                        </ul>
                      </td>
                      <td className={`${cell} text-sm whitespace-nowrap`}>
                        <ul>
                          {show.prices.map((p) => (
                            <li key={p.seatClass}>
                              {CLASS_NAMES[p.seatClass]} {formatRupees(p.pricePaise)}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className={cell}>
                        {show.bookedCount} / {show.totalSeats}
                      </td>
                      <td className={cell}>
                        <div className="flex flex-col items-start gap-2">
                          {/* Edit only before the start and while nobody has booked (O-05) */}
                          {new Date(show.startAt).getTime() > now && show.bookedCount === 0 && show.status === 'scheduled' && (
                            <Link to={`/owner/shows/${show.id}`} className="font-type underline" aria-label={`Edit ${show.movie.title} on ${formatShortDay(show.date)} at ${formatTime12(show.startTime)}`}>
                              Edit
                            </Link>
                          )}
                          {show.status === 'cancelled' && <Stamp tone="maroon">Cancelled</Stamp>}
                          {show.status === 'scheduled' && new Date(show.startAt).getTime() <= now && <span className="text-sm">Started</span>}
                          {canCancelShow(show, now) && cancelling !== show.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelling(show.id)
                                setMessage(null)
                              }}
                              className="min-h-11 font-type text-maroon underline dark:text-gold"
                              aria-label={`Cancel show ${show.movie.title} on ${formatShortDay(show.date)} at ${formatTime12(show.startTime)}`}
                            >
                              Cancel show
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,
                    cancelling === show.id && (
                      <tr key={`${show.id}-cancel`}>
                        <td colSpan={8} className={cell}>
                          <CancelShowPanel
                            show={show}
                            onClose={() => setCancelling(null)}
                            onCancelled={(result) => {
                              setCancelling(null)
                              setMessage(cancelledMessage(result))
                            }}
                          />
                        </td>
                      </tr>
                    ),
                  ])}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-3">
          <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
            Previous page
          </Button>
          <p>
            Page {filters.page} of {pages}
          </p>
          <Button variant="secondary" disabled={filters.page >= pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
            Next page
          </Button>
        </div>
      )}
    </div>
  )
}

// [[day, shows], …] in time order (the API sends them sorted)
function groupByDay(shows) {
  const groups = new Map()
  for (const show of shows) groups.set(show.date, [...(groups.get(show.date) ?? []), show])
  return [...groups]
}
