import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { usePublicSettings } from '../../api/settings.js'
import { useShow, useShowSeats } from '../../api/shows.js'
import AgeWarningDialog from '../../components/ui/AgeWarningDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import Seat, { BlockedSeat, LegendSeat } from '../../components/ui/Seat.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { formatRupees } from '../../validation/food.js'
import { CLASS_NAMES, formatShortDay } from '../../validation/shows.js'
import { hasAgeOk, needsAgeCheck, saveAgeOk } from '../public/movie.js'
import { showTimeText } from '../public/showList.js'
import { classSections, dropTaken, SEAT_MARKS, seatInfo, seatLabel, seatState, selectionSummary, takenMap, toggleSeat } from './seats.js'

// U-10 seat selection at /shows/:id (login needed, 9.2), inside the UI-20 box office
// window with UI-21 chair seats and the NF-04 legend.
// Step 1 of Phase 4: pick seats. "Proceed" (hold + timer, U-12) and live updates
// (Socket.io, U-10) come in the next steps.
export default function SeatPage() {
  const { id } = useParams()
  const show = useShow(id)

  if (show.isPending) return <p role="status" className="py-6">Loading…</p>
  if (show.isError) {
    if (['NOT_FOUND', 'VALIDATION_ERROR'].includes(show.error.code)) {
      return (
        <PaperCard title="Show not found">
          <div className="space-y-4">
            <p>This reel is missing from the projector room. The show may have started or been cancelled.</p>
            <ButtonLink to="/">Go to home</ButtonLink>
          </div>
        </PaperCard>
      )
    }
    return (
      <p role="alert" className="py-6 font-bold text-(--tone-alert)">
        {show.error.message}
      </p>
    )
  }
  return <SeatSelection key={id} show={show.data} />
}

function SeatSelection({ show }) {
  const navigate = useNavigate()
  const settings = usePublicSettings()
  const seats = useShowSeats(show.id, { enabled: !show.housefull })
  const [picked, setPicked] = useState([])
  const [message, setMessage] = useState(null)
  // U-08: an "A" movie opened straight from a link still asks first
  const [askAge, setAskAge] = useState(() => needsAgeCheck(show.movie) && !hasAgeOk(show.movie.id))

  const taken = useMemo(() => takenMap(seats.data), [seats.data])
  const info = useMemo(() => seatInfo(show.layout.grid, show.prices), [show])
  const sections = useMemo(() => classSections(show.layout.grid), [show])
  const priceOf = Object.fromEntries(show.prices.map((p) => [p.seatClass, p.pricePaise]))
  const max = settings.data?.maxSeatsPerBooking ?? 10 // BR-02

  // A picked seat that someone else took meanwhile (fresh seat list) drops out
  const selected = dropTaken(picked, taken)

  function pick(seatId) {
    const result = toggleSeat(selected, seatId, taken, max)
    setPicked(result.selected)
    setMessage(result.error)
  }

  const summary = selectionSummary(selected, info)
  const movieLink = `/movies/${show.movie.id}`

  return (
    <div className="space-y-6 py-6">
      {/* Header (UI-20): back, movie title, "Matinee · 2:30 PM · theatre" */}
      <header className="space-y-1">
        <Link to={movieLink} className="inline-flex min-h-11 items-center font-type underline">
          ← Back to {show.movie.title}
        </Link>
        <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">{show.movie.title}</h1>
        <p className="font-type text-lg">
          {formatShortDay(show.date)} · {showTimeText(show)} · {show.theatre.name}
        </p>
        <p className="text-sm">
          {[show.screen.name, show.language, show.format, show.subtitles && 'Subtitles'].filter(Boolean).join(' · ')}
        </p>
      </header>

      {show.housefull ? (
        <div className="flex flex-wrap items-center gap-4">
          <Stamp className="text-xl">Housefull</Stamp>
          <p className="font-type">All seats of this show are taken.</p>
          <ButtonLink to={movieLink} variant="secondary">
            Pick another show
          </ButtonLink>
        </div>
      ) : (
        <>
          <BoxOfficeWindow ready={seats.isSuccess}>
            {seats.isPending && <p role="status" className="py-6 text-center">Loading seats…</p>}
            {seats.isError && (
              <p role="alert" className="py-6 text-center font-bold text-maroon">
                {seats.error.message}
              </p>
            )}
            {seats.isSuccess && (
              <SeatMap sections={sections} priceOf={priceOf} taken={taken} selected={selected} onPick={pick} />
            )}
          </BoxOfficeWindow>

          <Legend />

          {/* Bottom bar (UI-20): seat summary, total, Proceed */}
          <div className="paper sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-card border border-ink bg-cream-light px-4 py-3 text-ink shadow-[0_-6px_16px_rgb(0_0_0/0.25)]">
            <div aria-live="polite">
              <p className="font-type font-bold">{summary.text}</p>
              {summary.totalText && <p className="text-sm">{summary.totalText}</p>}
              {message && <p className="text-sm font-bold text-maroon">{message}</p>}
            </div>
            <div className="text-right">
              <Button disabled>Proceed</Button>
              <p className="mt-1 text-xs">Holding seats comes in the next step.</p>
            </div>
          </div>
        </>
      )}

      <AgeWarningDialog
        open={askAge}
        movieTitle={show.movie.title}
        onCancel={() => navigate(movieLink)}
        onConfirm={() => {
          saveAgeOk(show.movie.id)
          setAskAge(false)
        }}
      />
    </div>
  )
}

// UI-20: wooden frame, arched window with grille + swinging "TICKETS" board, cream seat
// area, counter ledge with a ticket slot
function BoxOfficeWindow({ ready, children }) {
  const areaRef = useRef(null)
  // Phones: a wide map scrolls sideways inside the window; start in the middle
  useEffect(() => {
    const area = areaRef.current
    if (ready && area) area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2
  }, [ready])

  return (
    <section aria-label="Seat map" className="box-office">
      <div className="box-office-arch" aria-hidden="true">
        <div className="tickets-board">
          {/* two gold strings */}
          <span className="absolute -top-[14px] left-3 h-[14px] w-px bg-gold sm:-top-[22px] sm:h-[22px]" />
          <span className="absolute -top-[14px] right-3 h-[14px] w-px bg-gold sm:-top-[22px] sm:h-[22px]" />
          <span className="block rounded-sm border-2 border-gold bg-maroon px-3 py-0.5 font-heading text-sm tracking-[0.2em] text-cream sm:px-5 sm:text-lg">TICKETS</span>
        </div>
      </div>
      <div ref={areaRef} className="paper overflow-x-auto bg-cream px-3 py-5 text-ink [scrollbar-width:thin]">{children}</div>
      <div className="box-office-ledge" aria-hidden="true" />
    </section>
  )
}

function RowLetter({ label }) {
  return <span className="w-5 shrink-0 text-center font-type text-xs font-bold">{label}</span>
}

function SeatMap({ sections, priceOf, taken, selected, onPick }) {
  return (
    <div className="mx-auto w-max space-y-5">
      {sections.map((section, i) => (
        <div key={i} className="space-y-1">
          {section.seatClass && (
            <p className="pb-1 text-center font-type text-sm tracking-[0.2em] uppercase">
              {CLASS_NAMES[section.seatClass]} · {formatRupees(priceOf[section.seatClass] ?? 0)}
            </p>
          )}
          {section.rows.map((row, r) =>
            row.label ? (
              <div key={r} className="flex items-center gap-[3px]">
                <RowLetter label={row.label} />
                {row.cells.map((cell, c) => {
                  if (cell.type === 'aisle') return <span key={c} className="w-[30px] shrink-0 sm:w-[34px]" />
                  if (cell.type === 'blocked') return <BlockedSeat key={c} />
                  const state = seatState(cell.seatId, taken, selected)
                  return (
                    <Seat key={c} state={state} wheelchair={cell.wheelchair} label={seatLabel(cell, CLASS_NAMES[cell.seatClass], state)} onClick={() => onPick(cell.seatId)} />
                  )
                })}
                <RowLetter label={row.label} />
              </div>
            ) : (
              <div key={r} className="h-3" aria-hidden="true" /> // walkway (row without seats)
            ),
          )}
        </div>
      ))}

      {/* The screen is below the last row (A) */}
      <div className="pt-2 text-center" aria-hidden="true">
        <svg viewBox="0 0 300 24" className="mx-auto block h-6 w-full min-w-48">
          <path d="M6 20 Q150 -6 294 20" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="font-type text-xs tracking-[0.3em]">SCREEN THIS WAY</p>
      </div>
    </div>
  )
}

// NF-04 legend: the same marks as the seats
const LEGEND = [
  ['available', 'Available'],
  ['selected', 'Your pick'],
  ['booked', 'Booked'],
  ['held', 'Held by someone'],
  ['blocked', 'Not for sale'],
]
function Legend() {
  return (
    <ul aria-label="What the seats mean" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
      {LEGEND.map(([state, text]) => (
        <li key={state} className="flex items-center gap-2 text-sm">
          <span className="paper inline-flex rounded bg-cream p-0.5">
            <LegendSeat state={state} />
          </span>
          {text}
        </li>
      ))}
      <li className="flex items-center gap-2 text-sm">
        <span aria-hidden="true" className="font-bold text-ink dark:text-cream">
          {SEAT_MARKS.wheelchair}
        </span>{' '}
        Wheelchair space
      </li>
    </ul>
  )
}
