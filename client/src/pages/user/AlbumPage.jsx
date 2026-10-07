import { Link } from 'react-router'
import { useTicketAlbum } from '../../api/bookings.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import PaperTicket from './PaperTicket.jsx'
import { STAMPS, stubDateText, ticketInfo, tiltFor } from './ticket.js'

// /tickets: U-18 ticket album (UI-28). A scrapbook on cream pages: every booking is a paper
// ticket "pasted" with a piece of tape, a little tilted. Upcoming (full ticket with QR) on
// top, past ones below as stubs with stamps. Tap a ticket → /bookings/:id (details, ticket
// + invoice PDFs). Not here yet: badges (U-24, Phase 10), offline (U-19, Phase 11).
export default function AlbumPage() {
  const upcoming = useTicketAlbum('upcoming')
  const past = useTicketAlbum('past')

  const loading = upcoming.isPending || past.isPending
  const error = upcoming.error ?? past.error
  const empty = !loading && !error && upcoming.data.pages[0].total === 0 && past.data.pages[0].total === 0

  return (
    <div className="space-y-8 py-6">
      <h1 className="font-heading text-[2rem] leading-tight text-maroon sm:text-[2.5rem] dark:text-gold">Ticket album</h1>
      {loading && <p role="status">Loading…</p>}
      {error && <p role="alert" className="text-(--tone-alert)">{error.message}</p>}
      {empty && (
        <div className="album-page paper space-y-4 rounded-card p-6 text-ink">
          <p className="font-type text-lg">Your ticket album is empty. Book your first show!</p>
          <ButtonLink to="/">Find a show</ButtonLink>
        </div>
      )}
      {!loading && !error && !empty && (
        <>
          <AlbumSection title="Upcoming" query={upcoming} emptyText="No upcoming shows. Time to book the next one!">
            {(item) => (
              <Link to={`/bookings/${item.id}?from=album`} aria-label={`Open ticket ${item.bookingNumber}: ${item.show.movieTitle}`} className="block rounded-card">
                <PaperTicket booking={item} titleTag="h3" />
              </Link>
            )}
          </AlbumSection>
          <AlbumSection title="Past" query={past} emptyText="No past shows yet.">
            {(item) => <Stub item={item} />}
          </AlbumSection>
        </>
      )}
    </div>
  )
}

// One scrapbook page: pasted tickets + "Show more" (10 per page)
function AlbumSection({ title, query, emptyText, children }) {
  const items = query.data.pages.flatMap((p) => p.items)
  return (
    <section aria-labelledby={`album-${title}`} className="album-page paper space-y-6 rounded-card p-4 text-ink sm:p-6">
      <h2 id={`album-${title}`} className="font-type text-xl tracking-widest uppercase">
        {title}
      </h2>
      {items.length === 0 && <p className="font-type">{emptyText}</p>}
      <ul className="space-y-8">
        {items.map((item) => (
          <li key={item.id} className="pasted relative pt-3" style={{ '--tilt': `${tiltFor(item.id)}deg` }}>
            <span className="tape" aria-hidden="true" />
            {children(item)}
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          {query.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </Button>
      )}
    </section>
  )
}

// A past show: a small stub with a rubber stamp (Cancelled / Transferred)
function Stub({ item }) {
  const t = ticketInfo(item)
  const stamp = STAMPS[item.stamp]
  const body = (
    <div className="relative max-w-xl rounded-card border-2 border-dashed border-maroon bg-cream p-4">
      <h3 className="font-heading text-lg leading-tight">{item.show.movieTitle}</h3>
      <p className="font-body text-sm">{stubDateText(item.show)}</p>
      <p className="font-body text-sm">
        {item.show.theatreName} · {item.show.screenName}
      </p>
      <p className="font-body text-sm">
        {t.seatLabel} {t.seatsText} · {item.bookingNumber}
      </p>
      {stamp && (
        <Stamp tone={stamp.tone} className="absolute top-3 right-3">
          {stamp.text}
        </Stamp>
      )}
    </div>
  )
  if (!item.canOpen) return body // transferred away: the ticket belongs to the friend now
  return (
    <Link to={`/bookings/${item.id}?from=album`} aria-label={`Open ticket ${item.bookingNumber}: ${item.show.movieTitle}`} className="block max-w-xl rounded-card">
      {body}
    </Link>
  )
}
