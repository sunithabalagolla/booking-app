import { useState } from 'react'
import { useAdminTheatres, useApproveTheatre, useRejectTheatre } from '../../api/adminTheatres.js'
import { useAdminSettings } from '../../api/settings.js'
import Button from '../../components/ui/Button.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { formatDay } from '../../validation/movies.js'
import { THEATRE_STATUS_LABELS, THEATRE_STATUS_TONES } from '../../validation/theatres.js'
import { theatreActions } from './theatreActions.js'

// A-04 Theatre approvals: register table with Pending / Approved / Rejected / All tabs + city filter.
const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

// createdAt (ISO, UTC) → its IST day (BR-21)
const istDay = (iso) => new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
const cell = 'border border-ink px-3 py-2 align-top dark:border-cream-light'

export default function AdminTheatresPage() {
  const [status, setStatus] = useState('pending')
  const [cityCode, setCityCode] = useState('')
  const [page, setPage] = useState(1)
  const theatres = useAdminTheatres({ status, cityCode, page })
  const cities = useAdminSettings().data?.cities ?? []
  const data = theatres.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">Theatres</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div role="group" aria-label="Show theatres" className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.label}
              variant={status === tab.value ? 'primary' : 'secondary'}
              aria-pressed={status === tab.value}
              onClick={() => {
                setStatus(tab.value)
                setPage(1)
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="min-w-56">
          <SelectField
            label="City"
            placeholder="All cities"
            options={cities.map((c) => ({ value: c.code, label: c.name }))}
            value={cityCode}
            onChange={(e) => {
              setCityCode(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {theatres.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {theatres.error.message}
        </p>
      )}
      {data && data.items.length === 0 && <p className="font-type">{status === 'pending' ? 'No theatres are waiting.' : 'No theatres found.'}</p>}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">Theatres</caption>
            <thead className="font-type">
              <tr>
                {['Theatre', 'City and GSTIN', 'Owner', 'Sent', 'Status', 'Actions'].map((h) => (
                  <th key={h} scope="col" className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((theatre) => (
                <TheatreRow key={theatre.id} theatre={theatre} />
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

function TheatreRow({ theatre }) {
  const approve = useApproveTheatre()
  const reject = useRejectTheatre()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(null)

  const busy = approve.isPending || reject.isPending
  const error = approve.error ?? (reasonError ? null : reject.error)
  const actions = theatreActions(theatre)
  const ownerBlocked = theatre.owner.status === 'blocked'

  function sendReject() {
    if (reason.trim().length < 5) {
      setReasonError('Please give a reason (at least 5 characters).')
      return
    }
    setReasonError(null)
    reject.mutate({ id: theatre.id, reason: reason.trim() }, { onError: (err) => setReasonError(err.details?.reason ?? null) })
  }

  return (
    <tr>
      <td className={cell}>
        <p className="font-type font-bold">{theatre.name}</p>
        <p className="text-sm">{theatre.address}</p>
        {theatre.mapLink && (
          <a href={theatre.mapLink} target="_blank" rel="noreferrer noopener" className="text-sm underline">
            Open map
          </a>
        )}
        {theatre.photos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1">
            {theatre.photos.map((url, i) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer noopener">
                  <img src={url} alt={`${theatre.name} photo ${i + 1}`} className="h-12 w-16 rounded-btn object-cover" />
                </a>
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-2 text-sm">
          <li>{theatre.amenities.wheelchairAccess ? '✓ Wheelchair access' : '– No wheelchair access'}</li>
          <li>{theatre.amenities.parking ? '✓ Parking' : '– No parking'}</li>
        </ul>
        {theatre.rejectReason && <p className="mt-2 text-sm">Reason: {theatre.rejectReason}</p>}
      </td>
      <td className={cell}>
        <p>
          {theatre.city.name} <span className="text-sm">({theatre.city.state})</span>
        </p>
        <p className="font-body text-sm">{theatre.gstin}</p>
      </td>
      <td className={cell}>
        <p className="font-type">{theatre.owner.businessName}</p>
        <p className="text-sm">{theatre.owner.name}</p>
        <p className="text-sm break-all">{theatre.owner.email}</p>
        <p className="text-sm">{theatre.owner.phone}</p>
        {ownerBlocked && (
          <p className="mt-1">
            <Stamp tone="maroon" className="text-xs">
              Owner blocked
            </Stamp>
          </p>
        )}
      </td>
      <td className={`${cell} whitespace-nowrap`}>{formatDay(istDay(theatre.createdAt))}</td>
      <td className={cell}>
        <Stamp tone={THEATRE_STATUS_TONES[theatre.status]} className="text-sm whitespace-nowrap">
          {THEATRE_STATUS_LABELS[theatre.status]}
        </Stamp>
        {theatre.decidedBy && <p className="mt-2 text-sm">by {theatre.decidedBy.name}</p>}
      </td>
      <td className={cell}>
        <div className="flex flex-wrap gap-2">
          {actions.includes('approve') && (
            <Button onClick={() => approve.mutate({ id: theatre.id })} disabled={busy}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          )}
          {actions.includes('reject') && !rejecting && (
            <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy}>
              Reject
            </Button>
          )}
          {ownerBlocked && theatre.status !== 'approved' && <p className="text-sm">The owner is blocked.</p>}
        </div>

        {rejecting && (
          <div className="mt-3 space-y-2">
            <TextField label="Reason (sent to the owner)" value={reason} onChange={(e) => setReason(e.target.value)} error={reasonError} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={sendReject} disabled={busy}>
                {reject.isPending ? 'Rejecting…' : 'Reject theatre'}
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-2 text-sm font-bold text-(--tone-alert)">
            {error.message}
          </p>
        )}
      </td>
    </tr>
  )
}
