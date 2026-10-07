import { ticketInfo } from './ticket.js'

// U-17 / UI-27 paper ticket: cream paper, maroon border, details + signed QR, and a
// counterfoil behind a dotted line with the ticket number and total.
//   tear:     the counterfoil tears off (UI-34, CSS .ticket-stub) — only on "Booking confirmed"
//   titleTag: heading level of the movie title (h2 on the ticket page, h3 in the album)
export default function PaperTicket({ booking, tear = false, titleTag: Title = 'h2' }) {
  const t = ticketInfo(booking)
  const row = (label, value, strong = false) => (
    <div>
      <dt className="font-type text-xs tracking-widest text-(--tone-mustard) uppercase">{label}</dt>
      <dd className={`font-body ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  )
  return (
    <section aria-label={`Ticket ${booking.bookingNumber}`} className="paper ticket max-w-3xl rounded-card border-2 border-maroon bg-cream text-ink sm:flex">
      {/* Main part */}
      <div className="flex-1 space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="font-heading text-xl text-maroon">TALKIES</p>
          <p className="border-2 border-maroon px-2 py-0.5 font-heading text-maroon">Admit {t.admit}</p>
        </div>
        <div>
          <Title className="font-heading text-2xl leading-tight">{booking.show.movieTitle}</Title>
          <p className="font-body text-sm">{t.movieInfo}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <dl className="space-y-2">
            {row('Show', t.showText)}
            {row('Theatre', `${booking.show.theatreName}, ${booking.show.theatreAddress}`)}
            {row('Screen · Class', `${booking.show.screenName} · ${t.classText}`)}
            {row(t.seatLabel, t.seatsText, true)}
            {t.foodText && row('Food', t.pickup ? `${t.foodText} · ${t.pickup}` : t.foodText)}
          </dl>
          <div className="flex flex-col items-center gap-1 self-start justify-self-center">
            <img src={booking.qrDataUrl} alt={`QR code of ticket ${booking.bookingNumber}`} width="176" height="176" className="rounded-sm border border-ink bg-white" />
            <p className="font-body text-lg font-bold tracking-widest">{booking.bookingNumber}</p>
            <p className="font-type text-xs">Show this QR at the gate</p>
          </div>
        </div>
      </div>
      {/* Counterfoil: dotted tear line */}
      <div
        className={`${tear ? 'ticket-stub ' : ''}flex flex-row items-center justify-around gap-3 border-t-2 border-dotted border-maroon p-4 text-center sm:w-40 sm:flex-col sm:justify-center sm:border-t-0 sm:border-l-2`}
      >
        <p className="font-heading text-maroon">TALKIES</p>
        <div>
          <p className="font-type text-xs tracking-widest text-(--tone-mustard) uppercase">Ticket no.</p>
          <p className="font-body text-sm font-bold">{booking.bookingNumber}</p>
        </div>
        <div>
          <p className="font-type text-xs tracking-widest text-(--tone-mustard) uppercase">Total</p>
          <p className="font-body font-bold">{t.totalText}</p>
        </div>
      </div>
    </section>
  )
}
