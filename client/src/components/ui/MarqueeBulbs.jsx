// UI-14 row (or column) of gold marquee bulbs that blink one after another (CSS loop
// in theme.css, timing from motion.js). `offset` shifts the blink order, so the 4
// sides of a banner chase round. Only decoration, so screen readers skip it.
export default function MarqueeBulbs({ count = 16, vertical = false, offset = 0, total, className = '' }) {
  const n = total ?? count
  return (
    <div aria-hidden="true" className={`flex justify-between ${vertical ? 'flex-col py-2' : 'px-2'} ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="bulb block h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_6px_var(--color-gold)]" style={{ '--i': offset + i, '--n': n }} />
      ))}
    </div>
  )
}
