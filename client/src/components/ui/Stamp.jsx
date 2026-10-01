// Rubber stamp (UI-05): bordered, tilted text. Colours from UI-30:
// green = Paid / Approved / Verified, mustard = Pending, maroon = Cancelled / Rejected.
const tones = {
  green: 'text-green',
  mustard: 'text-mustard',
  maroon: 'text-maroon',
}

export default function Stamp({ tone = 'maroon', className = '', children }) {
  return <span className={`stamp ${tones[tone]} ${className}`}>{children}</span>
}
