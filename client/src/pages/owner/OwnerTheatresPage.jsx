import { Link, useLocation } from 'react-router'
import { useMyTheatres } from '../../api/ownerTheatres.js'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { THEATRE_STATUS_LABELS, THEATRE_STATUS_TONES } from '../../validation/theatres.js'

// O-03: the owner's theatres (UI-30 register look)
const cell = 'border border-ink px-3 py-2 align-top dark:border-cream-light'

export default function OwnerTheatresPage() {
  const location = useLocation()
  const theatres = useMyTheatres()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">My theatres</h1>
        <ButtonLink to="/owner/theatres/new">+ Add theatre</ButtonLink>
      </div>

      {location.state?.message && (
        <p role="status" className="font-type">
          {location.state.message}
        </p>
      )}

      {theatres.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {theatres.error.message}
        </p>
      )}

      {theatres.data?.length === 0 && <p className="font-type">No theatres yet. Add your first theatre.</p>}

      {theatres.data?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">My theatres</caption>
            <thead className="font-type">
              <tr>
                {['Theatre', 'City', 'Address', 'Amenities', 'Status', 'Screens and canteen'].map((h) => (
                  <th key={h} scope="col" className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {theatres.data.map((t) => (
                <tr key={t.id}>
                  <td className={cell}>
                    <Link to={`/owner/theatres/${t.id}`} className="font-type font-bold underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className={cell}>{t.city.name}</td>
                  <td className={cell}>{t.address}</td>
                  <td className={cell}>
                    <ul className="text-sm">
                      <li>{t.amenities.wheelchairAccess ? '✓ Wheelchair access' : '– No wheelchair access'}</li>
                      <li>{t.amenities.parking ? '✓ Parking' : '– No parking'}</li>
                    </ul>
                  </td>
                  <td className={cell}>
                    <Stamp tone={THEATRE_STATUS_TONES[t.status]} className="text-sm whitespace-nowrap">
                      {THEATRE_STATUS_LABELS[t.status]}
                    </Stamp>
                    {t.rejectReason && <p className="mt-2 text-sm">Reason: {t.rejectReason}</p>}
                  </td>
                  <td className={cell}>
                    <ul className="space-y-1">
                      <li>
                        {/* O-04 */}
                        <Link to={`/owner/theatres/${t.id}/screens`} className="font-type underline" aria-label={`Screens of ${t.name}`}>
                          Screens
                        </Link>
                      </li>
                      <li>
                        {/* O-07 */}
                        <Link to={`/owner/theatres/${t.id}/food`} className="font-type underline" aria-label={`Canteen of ${t.name}`}>
                          Canteen
                        </Link>
                      </li>
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
