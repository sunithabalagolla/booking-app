// Indian veg / non-veg mark: green square with a dot = veg, brown square with a
// triangle = non-veg. The word is shown too, so it is not colour only (NF-03).
// The colours sit on a cream box, so they look the same in Day and Night show.
export default function VegMark({ isVeg, className = '' }) {
  const colour = isVeg ? 'var(--color-green)' : 'var(--color-wood)'
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden="true">
        <rect x="1.5" y="1.5" width="17" height="17" fill="#F3E9D2" stroke={colour} strokeWidth="2.5" />
        {isVeg ? <circle cx="10" cy="10" r="4.5" fill={colour} /> : <path d="M10 5 L15 14 H5 Z" fill={colour} />}
      </svg>
      {isVeg ? 'Veg' : 'Non-veg'}
    </span>
  )
}
