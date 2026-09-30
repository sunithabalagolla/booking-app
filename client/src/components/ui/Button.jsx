// Maroon primary button (UI-05: 6 px corners). Touch target at least 44 px high (16.8).
export default function Button({ className = '', variant = 'primary', ...props }) {
  const look =
    variant === 'primary'
      ? 'bg-maroon text-cream hover:bg-maroon/90'
      : 'border border-ink bg-transparent text-ink hover:bg-cream'
  return (
    <button
      type="button"
      className={`min-h-11 rounded-btn px-5 py-2 font-type focus:outline-2 focus:outline-offset-2 focus:outline-maroon disabled:opacity-60 ${look} ${className}`}
      {...props}
    />
  )
}
