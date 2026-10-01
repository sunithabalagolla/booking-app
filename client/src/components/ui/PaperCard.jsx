import Card from './Card.jsx'

// Small centred paper card for short forms and messages (sign up, log in…).
// The logo is in the site header, so the card only has the page title.
export default function PaperCard({ title, children }) {
  return (
    <div className="mx-auto max-w-md py-6">
      <Card>
        <h1 className="mb-4 font-type text-2xl">{title}</h1>
        {children}
      </Card>
    </div>
  )
}
