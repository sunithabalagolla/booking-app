import { Link, useLocation, useParams } from 'react-router'
import { useTheatreScreens } from '../../api/ownerScreens.js'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { THEATRE_STATUS_LABELS, THEATRE_STATUS_TONES } from '../../validation/theatres.js'

// O-04: the screens of one of my theatres (UI-30 register look)
const cell = 'border border-ink px-3 py-2 align-top dark:border-cream-light'

export default function OwnerScreensPage() {
  const { id } = useParams()
  const location = useLocation()
  const screens = useTheatreScreens(id)
  const theatre = screens.data?.theatre

  return (
    <div className="space-y-6">
      <p>
        <Link to="/owner/theatres" className="font-type underline">
          ← My theatres
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-maroon dark:text-gold">Screens</h1>
          {theatre && (
            <p className="mt-1 flex flex-wrap items-center gap-3 font-type text-lg">
              {theatre.name}
              <Stamp tone={THEATRE_STATUS_TONES[theatre.status]} className="text-sm">
                {THEATRE_STATUS_LABELS[theatre.status]}
              </Stamp>
            </p>
          )}
        </div>
        <ButtonLink to={`/owner/theatres/${id}/screens/new`}>+ Add screen</ButtonLink>
      </div>

      {theatre && theatre.status !== 'approved' && (
        <p role="note" className="font-type">
          You can add screens now. Shows go live only after the admin approves this theatre.
        </p>
      )}

      {location.state?.message && (
        <p role="status" className="font-type">
          {location.state.message}
        </p>
      )}

      {screens.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {screens.error.message}
        </p>
      )}
      {screens.isPending && <p role="status">Loading…</p>}

      {screens.data?.items.length === 0 && <p className="font-type">No screens yet. Add your first screen and draw its seat layout.</p>}

      {screens.data?.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">Screens of {theatre.name}</caption>
            <thead className="font-type">
              <tr>
                {['Screen', 'Format', 'Balcony', 'First class', 'Second class', 'Total seats', 'Wheelchair-friendly', 'Cleaning break'].map((h) => (
                  <th key={h} scope="col" className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {screens.data.items.map((s) => (
                <tr key={s.id}>
                  <td className={cell}>
                    <Link to={`/owner/screens/${s.id}`} className="font-type font-bold underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className={cell}>{s.format}</td>
                  <td className={cell}>{s.seatCount.balcony}</td>
                  <td className={cell}>{s.seatCount.first}</td>
                  <td className={cell}>{s.seatCount.second}</td>
                  <td className={cell}>{s.totalSeats}</td>
                  <td className={cell}>{s.wheelchairFriendly ? '✓ Yes' : '– No'}</td>
                  <td className={cell}>{s.cleaningBreakMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
