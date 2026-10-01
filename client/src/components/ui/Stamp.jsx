// Rubber stamp (UI-05): bordered, tilted text. Colours from UI-30:
// green = Paid / Approved / Verified, mustard = Pending, maroon = Cancelled / Rejected.
// Green and mustard get lighter versions on the Night show page (--tone-* in theme.css).
const tones = {
  green: 'text-(--tone-green)',
  mustard: 'text-(--tone-mustard)',
  maroon: 'text-maroon',
}

export default function Stamp({ tone = 'maroon', className = '', children }) {
  return <span className={`stamp ${tones[tone]} ${className}`}>{children}</span>
}
