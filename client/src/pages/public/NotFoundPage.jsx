import { Link } from 'react-router'

// Placeholder until the vintage 404 page (UI-36) is built in Phase 10
export default function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link to="/">Go to home</Link>
    </main>
  )
}
