// UI-26 coming soon ticker ("Stage" design Section 3): thin dark strip with gold lines,
// cream typewriter text scrolling right to left (~30 s a loop, motion.js). Pauses on
// hover, tap or keyboard focus. Reduce motion: no scrolling, the first message only.
// The list is drawn twice so the loop is seamless; screen readers get it once.
export default function Ticker({ messages, label = 'Coming soon' }) {
  if (messages.length === 0) return null
  const items = (copy) =>
    messages.map((text, i) => (
      <li key={`${copy}-${i}`} className="ticker-item flex shrink-0 items-center gap-6 pr-6 whitespace-nowrap">
        <span>{text}</span>
        <span aria-hidden="true" className="text-gold">
          ✦
        </span>
      </li>
    ))

  return (
    <section aria-label={label} tabIndex={0} className="ticker overflow-hidden border-y-2 border-gold bg-[#120C08] py-2 font-type text-cream focus:outline-2 focus:outline-offset-2 focus:outline-gold">
      <div className="ticker-track">
        <ul className="flex">{items('a')}</ul>
        <ul aria-hidden="true" className="flex">
          {items('b')}
        </ul>
      </div>
    </section>
  )
}
