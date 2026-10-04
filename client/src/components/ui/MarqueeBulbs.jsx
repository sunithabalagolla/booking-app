// UI-14 row of gold marquee bulbs that blink one after another (CSS loop in theme.css,
// timing from motion.js). Only decoration, so screen readers skip it.
export default function MarqueeBulbs({ count = 16, className = '' }) {
  return (
    <div aria-hidden="true" className={`flex justify-between px-2 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="bulb block h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_6px_var(--color-gold)]" style={{ '--i': i, '--n': count }} />
      ))}
    </div>
  )
}
