import { useId, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import {
  BRUSHES,
  cellLabel,
  layoutPreview,
  MAX_COLS,
  MAX_ROWS,
  paintAt,
  paintColumn,
  paintRow,
  resizeGrid,
  SEAT_CLASS_LABELS,
} from '../../validation/screens.js'

// O-04 seat layout grid editor. Pick a brush, then click places (or a whole row / column).
// Every place is a real button with a screen reader label; marks + colours (NF-04).
// The screen is at the bottom ("SCREEN THIS WAY"), like the user seat map (UI-20).

// Looks per place. Seats keep ink / cream text for 4.5:1 contrast.
const LOOK = {
  balcony: 'border-maroon bg-maroon text-cream',
  first: 'border-ink bg-gold text-ink',
  second: 'border-ink bg-cream text-ink',
  aisle: 'border-dotted border-ink/40 bg-transparent',
  blocked: 'border-dashed border-ink bg-transparent text-ink',
}
const MARKS = Object.fromEntries(BRUSHES.map((b) => [b.key, b.mark]))

const lookOf = (cell) => (cell.type === 'seat' ? LOOK[cell.seatClass] : LOOK[cell.type])
const markOf = (cell) => (cell.type === 'seat' ? (cell.wheelchair ? MARKS.wheelchair : MARKS[cell.seatClass]) : MARKS[cell.type])

const placeClass = 'h-8 w-7.5 rounded-sm border text-xs font-bold focus:outline-2 focus:outline-offset-1 focus:outline-maroon'
const quickClass = 'h-8 w-7.5 rounded-sm text-ink hover:bg-cream focus:outline-2 focus:outline-offset-1 focus:outline-maroon'

export default function SeatLayoutEditor({ grid, onChange, error }) {
  const id = useId()
  const [brush, setBrush] = useState('second')
  const [size, setSize] = useState({ rows: String(grid.length), cols: String(grid[0]?.length ?? 0) })
  const [sizeError, setSizeError] = useState('')

  const preview = layoutPreview(grid)
  const brushLabel = BRUSHES.find((b) => b.key === brush).label

  function applySize() {
    const rows = Number(size.rows)
    const cols = Number(size.cols)
    if (!Number.isInteger(rows) || rows < 1 || rows > MAX_ROWS || !Number.isInteger(cols) || cols < 1 || cols > MAX_COLS) {
      setSizeError(`Rows must be 1 to ${MAX_ROWS} and columns 1 to ${MAX_COLS}.`)
      return
    }
    setSizeError('')
    onChange(resizeGrid(grid, rows, cols))
  }

  return (
    <div className="space-y-4">
      {/* Grid size */}
      <fieldset className="space-y-2">
        <legend className="font-type">Grid size</legend>
        <div className="flex flex-wrap items-end gap-3">
          <SizeInput label={`Rows (max ${MAX_ROWS})`} value={size.rows} onChange={(rows) => setSize((s) => ({ ...s, rows }))} />
          <SizeInput label={`Columns (max ${MAX_COLS})`} value={size.cols} onChange={(cols) => setSize((s) => ({ ...s, cols }))} />
          <Button variant="secondary" onClick={applySize}>
            Change size
          </Button>
        </div>
        <p className="text-sm">Rows are added or removed at the front (near the screen), columns at the right.</p>
        {sizeError && (
          <p role="alert" className="text-sm font-bold text-(--tone-alert)">
            {sizeError}
          </p>
        )}
      </fieldset>

      {/* Brushes */}
      <fieldset>
        <legend className="font-type">Brush: click a place, or ▸ / ▾ for a whole row / column</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BRUSHES.map((b) => (
            <label
              key={b.key}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border border-ink px-3 font-type has-checked:bg-ink has-checked:text-cream has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-maroon"
            >
              <input type="radio" name={`${id}-brush`} value={b.key} checked={brush === b.key} onChange={() => setBrush(b.key)} className="sr-only" />
              <span aria-hidden="true" className={`inline-flex h-6 w-6 items-center justify-center rounded-sm border text-xs font-bold ${LOOK[b.key] ?? LOOK.second}`}>
                {b.mark}
              </span>
              {b.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* The grid. Row letters on both sides; the screen is at the bottom. */}
      <div className="overflow-x-auto rounded-card border border-ink bg-cream-light p-3">
        <table className="mx-auto border-separate border-spacing-0.5">
          <caption className="sr-only">Seat layout. The screen is below the last row.</caption>
          <thead>
            <tr>
              <td />
              <td />
              {grid[0]?.map((_, c) => (
                <th key={c} scope="col" className="p-0">
                  <button type="button" className={quickClass} aria-label={`Paint column ${c + 1} with ${brushLabel}`} onClick={() => onChange(paintColumn(grid, c, brush))}>
                    ▾
                  </button>
                </th>
              ))}
              <td />
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <td className="p-0">
                  <button type="button" className={quickClass} aria-label={`Paint row ${r + 1} with ${brushLabel}`} onClick={() => onChange(paintRow(grid, r, brush))}>
                    ▸
                  </button>
                </td>
                <RowLabel label={preview.labels[r]} />
                {row.map((cell, c) => (
                  <td key={c} className="p-0">
                    <button
                      type="button"
                      className={`${placeClass} ${lookOf(cell)}`}
                      aria-label={cellLabel(cell, preview.seatIds[r][c], r, c)}
                      title={preview.seatIds[r][c] ?? undefined}
                      onClick={() => onChange(paintAt(grid, r, c, brush))}
                    >
                      <span aria-hidden="true">{markOf(cell)}</span>
                    </button>
                  </td>
                ))}
                <RowLabel label={preview.labels[r]} />
              </tr>
            ))}
          </tbody>
        </table>
        <ScreenThisWay />
      </div>

      {/* Legend: same marks as on the places (NF-04) */}
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {BRUSHES.map((b) => (
          <li key={b.key} className="flex items-center gap-1">
            <span aria-hidden="true" className={`inline-flex h-5 w-5 items-center justify-center rounded-sm border text-xs font-bold ${LOOK[b.key] ?? LOOK.second}`}>
              {b.mark}
            </span>
            {b.label}
          </li>
        ))}
      </ul>

      {/* Live seat summary */}
      <p aria-live="polite" className="font-type">
        {Object.entries(SEAT_CLASS_LABELS)
          .map(([key, label]) => `${label} ${preview.seatCount[key]}`)
          .join(' · ')}{' '}
        · <strong>Total {preview.totalSeats} seats</strong> · Wheelchair spaces {preview.wheelchairSpaces} (wheelchair-friendly:{' '}
        {preview.wheelchairFriendly ? 'yes' : 'no'})
      </p>
      {error && (
        <p role="alert" className="text-sm font-bold text-(--tone-alert)">
          {error}
        </p>
      )}
    </div>
  )
}

function SizeInput({ label, value, onChange }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-24 rounded-btn border border-ink bg-cream px-3 py-2 text-ink focus:outline-2 focus:outline-offset-2 focus:outline-maroon"
      />
    </div>
  )
}

// Row letter (empty for rows without seats)
function RowLabel({ label }) {
  return (
    <th scope="row" className="w-6 px-1 text-center font-type text-sm">
      {label ?? <span className="sr-only">No seats</span>}
    </th>
  )
}

// Curved screen line at the bottom (UI-20)
function ScreenThisWay() {
  return (
    <div className="mt-3 text-center" aria-hidden="true">
      <svg viewBox="0 0 300 24" className="mx-auto h-6 w-full max-w-md">
        <path d="M6 20 Q150 -4 294 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="font-type text-sm tracking-[0.3em]">SCREEN THIS WAY</p>
    </div>
  )
}
