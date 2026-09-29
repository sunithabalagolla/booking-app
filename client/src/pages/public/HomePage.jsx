// Placeholder until U-05 (Home page) is built in Phase 3.
// For now it shows the Talkies theme (UI-01 to UI-05) so we can check it.

const colours = [
  { name: 'Paper cream', className: 'bg-cream', dark: false },
  { name: 'Curtain maroon', className: 'bg-maroon', dark: true },
  { name: 'Marquee gold', className: 'bg-gold', dark: false },
  { name: 'Bottle green', className: 'bg-green', dark: true },
  { name: 'Ink brown', className: 'bg-ink', dark: true },
  { name: 'Wood brown', className: 'bg-wood', dark: true },
  { name: 'Light cream', className: 'bg-cream-light', dark: false },
  { name: 'Stage dark', className: 'bg-stage', dark: true },
]

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4">
      {/* Maroon is too dark on the Night show background, so headings turn gold */}
      <h1 className="font-heading text-4xl text-maroon dark:text-gold">Talkies – coming soon</h1>

      <section className="space-y-2">
        <h2 className="font-type text-xl">Colours (UI-01)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {colours.map((c) => (
            <div
              key={c.name}
              className={`${c.className} ${c.dark ? 'text-cream' : 'text-ink'} rounded-card border border-ink p-3 text-sm`}
            >
              {c.name}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-type text-xl">Fonts (UI-03)</h2>
        <p className="font-heading text-2xl">Rye – Admit one</p>
        <p className="font-type text-2xl">Special Elite – Sholay</p>
        <p className="font-body text-2xl">Courier Prime – ₹150.00</p>
      </section>

      <section className="space-y-4">
        <h2 className="font-type text-xl">Shapes (UI-05)</h2>
        <button type="button" className="rounded-btn bg-maroon px-5 py-3 text-cream">
          Book tickets
        </button>
        <div className="rounded-card border border-ink bg-cream-light p-4 text-ink">
          <p className="font-type">Card with 8 px corners</p>
          <div className="tear-line my-3" />
          <p>Below the tear line</p>
        </div>
        <p className="py-4">
          <span className="stamp text-2xl text-maroon dark:text-gold">Housefull</span>
        </p>
      </section>
    </main>
  )
}
