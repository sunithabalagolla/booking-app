import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAdminCoupons, useApprovedTheatres } from '../../api/adminCoupons.js'
import { useAdminSettings } from '../../api/settings.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { COUPON_STATUS_LABELS, COUPON_STATUS_TONES, COUPON_STATUSES, offerText, usedText, whereText } from '../../validation/coupons.js'
import { formatShortDay } from '../../validation/shows.js'

// A-06: the admin's coupon register (UI-30 ledger look). Search by code, status filter, pages.
const statusOptions = COUPON_STATUSES.map((s) => ({ value: s, label: COUPON_STATUS_LABELS[s] }))
const cell = 'border border-ink px-3 py-2 dark:border-cream-light'

export default function AdminCouponsPage() {
  const location = useLocation()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const coupons = useAdminCoupons({ q, status, page })
  const settings = useAdminSettings()
  const theatres = useApprovedTheatres()
  const data = coupons.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const cityNames = Object.fromEntries((settings.data?.cities ?? []).map((c) => [c.code, c.name]))
  const theatreNames = Object.fromEntries((theatres.data ?? []).map((t) => [t.id, t.name]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">Coupons</h1>
        <ButtonLink to="/admin/coupons/new">+ Add coupon</ButtonLink>
      </div>

      {location.state?.message && (
        <p role="status" className="font-type">
          {location.state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Search by code"
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

      {coupons.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {coupons.error.message}
        </p>
      )}
      {data && data.items.length === 0 && <p className="font-type">No coupons found.</p>}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">Coupons, newest first</caption>
            <thead className="font-type">
              <tr>
                {['Code', 'Offer', 'Dates', 'Used', 'Where', 'Shown', 'Status'].map((h) => (
                  <th key={h} scope="col" className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td className={cell}>
                    <Link to={`/admin/coupons/${c.id}`} className="font-type font-bold tracking-wider underline">
                      {c.code}
                    </Link>
                  </td>
                  <td className={cell}>{offerText(c)}</td>
                  <td className={`${cell} whitespace-nowrap`}>
                    {formatShortDay(c.startDate)} – {formatShortDay(c.endDate)}
                  </td>
                  <td className={`${cell} font-type whitespace-nowrap tabular-nums`}>{usedText(c)}</td>
                  <td className={cell}>{whereText(c, cityNames, theatreNames)}</td>
                  <td className={cell}>
                    <Stamp tone={c.isPublic ? 'green' : 'mustard'} className="text-sm whitespace-nowrap">
                      {c.isPublic ? 'Public' : 'Secret'}
                    </Stamp>
                  </td>
                  <td className={cell}>
                    <Stamp tone={COUPON_STATUS_TONES[c.status]} className="text-sm whitespace-nowrap">
                      {COUPON_STATUS_LABELS[c.status]}
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
