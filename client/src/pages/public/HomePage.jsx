// Home. U-04: first the city (flow 9.2); the real Home lists come with U-05.
// Until then it also shows the Talkies theme (UI-01 to UI-05) so we can check it.
import { useCurrentCity } from '../../api/cities.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import CityChooser from '../../components/ui/CityChooser.jsx'
import Stamp from '../../components/ui/Stamp.jsx'

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
  const { city, cities, setCity } = useCurrentCity()

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      {/* Maroon is too dark on the Night show background, so headings turn gold */}
      {cities.isPending && <p role="status">Loading…</p>}
      {cities.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {cities.error.message}
        </p>
      )}
      {cities.data && !city && <CityChooser cities={cities.data} onPick={setCity} />}
      {city && (
        <section className="space-y-1">
          <h1 className="font-heading text-4xl text-maroon dark:text-gold">Now showing in {city.name}</h1>
          <p className="font-type">The movies of {city.name} come here next (U-05).</p>
        </section>
      )}

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
        <div className="flex flex-wrap gap-3">
          <Button>Book tickets</Button>
          <Button variant="secondary">Secondary</Button>
        </div>
        <Card footer={<p>Below the tear line</p>}>
          <p className="font-type">Card with 8 px corners</p>
        </Card>
        <p className="flex flex-wrap gap-8 py-4">
          <Stamp className="text-2xl dark:text-gold">Housefull</Stamp>
          <Stamp tone="green" className="text-2xl">
            Approved
          </Stamp>
          <Stamp tone="mustard" className="text-2xl">
            Pending
          </Stamp>
        </p>
      </section>
    </div>
  )
}
