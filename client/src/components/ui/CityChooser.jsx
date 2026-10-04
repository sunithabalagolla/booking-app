import Card from './Card.jsx'

// U-04 first visit (flow 9.2 "Select city"): a card with one button per city.
// No pop-up and no location detection (decided 2026-10-04).
export default function CityChooser({ cities, onPick }) {
  return (
    <Card as="section" className="mx-auto max-w-xl">
      <h1 className="font-heading text-2xl text-maroon">Pick your city</h1>
      <p className="mt-1 font-type">We show the movies and shows of the city you pick. You can change it any time at the top.</p>
      {cities.length === 0 ? (
        <p className="mt-4 font-type">No cinemas are open yet. Please come back soon.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cities.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => onPick(c.code)}
                className="flex min-h-11 w-full items-center justify-center rounded-btn border border-ink px-3 font-type hover:bg-cream focus:outline-2 focus:outline-offset-2 focus:outline-maroon"
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
