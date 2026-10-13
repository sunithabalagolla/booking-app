import { useState } from 'react'
import { useCheckinReport } from '../../api/ownerCheckins.js'
import { useMyTheatres } from '../../api/ownerTheatres.js'
import Button from '../../components/ui/Button.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { formatShortDay, formatTime12, istToday, SHOW_LABEL_NAMES } from '../../validation/shows.js'
import { gateTime } from '../staff/scan.js'
import { anyGateOpen, cameShare, GATE_STAMPS, notCome } from './checkinReport.js'

// O-10: per show of one day, tickets booked vs came (Entered) (UI-30 register look).
// One gate scan lets the whole booking in, so the numbers are tickets (seats).
const cell = 'border border-ink px-3 py-2 align-top dark:border-cream-light'
const num = `${cell} text-right font-body`
const COLUMNS = ['Time', 'Movie', 'Theatre · Screen', 'Booked', 'Came', 'Not come', 'Came %', 'Gate']
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

export default function OwnerCheckinsPage() {
  const theatres = useMyTheatres()
  const [filters, setFilters] = useState({ date: istToday(), theatreId: '' })
  const report = useCheckinReport(filters)
  const items = report.data?.items ?? []
  const totals = report.data?.totals

  const set = (changes) => setFilters((f) => ({ ...f, ...changes }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">Check-in report</h1>
        <Button variant="secondary" onClick={() => report.refetch()} disabled={report.isFetching}>
          {report.isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <p className="font-type">
        Tickets booked and tickets that came in through the gate (scanned &quot;Entered&quot;).
        {anyGateOpen(items) && ' A gate is open: this page updates every 30 seconds.'}
      </p>

      {/* Filters */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Date" type="date" value={filters.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
        <SelectField
          label="Theatre"
          options={[{ value: '', label: 'All theatres' }, ...(theatres.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
          value={filters.theatreId}
          onChange={(e) => set({ theatreId: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => set({ date: addDays(filters.date, -1) })}>
          ← Previous day
        </Button>
        <p className="font-type">{formatShortDay(filters.date)}</p>
        <Button variant="secondary" onClick={() => set({ date: addDays(filters.date, 1) })}>
          Next day →
        </Button>
      </div>

      {report.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {report.error.message}
        </p>
      )}
      {report.isPending && <p role="status">Loading…</p>}

      {report.data && items.length === 0 && <p className="font-type">No shows on this day.</p>}

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">Check-in report for {formatShortDay(filters.date)}</caption>
            <thead className="font-type">
              <tr>
                {COLUMNS.map((h) => (
                  <th key={h} scope="col" className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((show) => {
                const gate = GATE_STAMPS[show.gate]
                return (
                  <tr key={show.id}>
                    <td className={`${cell} whitespace-nowrap`}>
                      <span className="font-type">{SHOW_LABEL_NAMES[show.label]}</span> · {formatTime12(show.startTime)}
                    </td>
                    <th scope="row" className={`${cell} font-normal`}>
                      <span className="font-type font-bold">{show.movie.title}</span>
                    </th>
                    <td className={cell}>
                      {show.theatre.name} · {show.screen.name}
                    </td>
                    <td className={num}>{show.booked}</td>
                    <td className={num}>{show.came}</td>
                    <td className={num}>{notCome(show.booked, show.came)}</td>
                    <td className={num}>{cameShare(show.booked, show.came)}</td>
                    <td className={cell}>
                      {gate.tone ? <Stamp tone={gate.tone}>{gate.label}</Stamp> : <span className="font-type">{gate.label}</span>}
                      {show.gate === 'not_open' && <span className="block text-sm">opens {gateTime(show.gateOpensAt)}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {totals && (
              <tfoot className="font-bold">
                <tr>
                  <th scope="row" colSpan={3} className={`${cell} font-type`}>
                    Day total
                  </th>
                  <td className={num}>{totals.booked}</td>
                  <td className={num}>{totals.came}</td>
                  <td className={num}>{notCome(totals.booked, totals.came)}</td>
                  <td className={num}>{cameShare(totals.booked, totals.came)}</td>
                  <td className={cell} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
