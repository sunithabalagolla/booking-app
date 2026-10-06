// UI-32 film reel: spins while a payment is processing (1 s per turn, .film-reel in
// theme.css). Reduce motion: a still reel. Decorative: the text next to it says what happens.
export default function FilmReel({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={`film-reel ${className}`}>
      <circle cx="32" cy="32" r="29" fill="var(--color-ink)" stroke="var(--color-gold)" strokeWidth="3" />
      {/* five holes around the hub */}
      {[0, 72, 144, 216, 288].map((deg) => (
        <circle key={deg} cx={32 + 16 * Math.cos((deg * Math.PI) / 180)} cy={32 + 16 * Math.sin((deg * Math.PI) / 180)} r="7" fill="var(--color-cream)" />
      ))}
      <circle cx="32" cy="32" r="5" fill="var(--color-gold)" />
    </svg>
  )
}
