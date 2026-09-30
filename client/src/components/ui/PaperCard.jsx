// Simple paper card page frame for small forms (sign up, messages).
// The full vintage header and footer come later in Phase 1.
export default function PaperCard({ title, children }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4">
      <p className="mb-4 text-center font-heading text-3xl text-maroon dark:text-gold">Talkies</p>
      <section className="rounded-card border border-ink bg-cream-light p-6 text-ink dark:border-cream-light">
        <h1 className="mb-4 font-type text-2xl">{title}</h1>
        {children}
      </section>
    </main>
  )
}
