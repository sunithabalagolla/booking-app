// Paper card (UI-05: 8 px corners, thin ink border, flat, no heavy shadow).
// Stays light paper in Night show too, so text inside is always ink on cream.
// `footer` shows below a dotted ticket tear line.
export default function Card({ as: Tag = 'section', className = '', footer, children }) {
  return (
    <Tag className={`rounded-card border border-ink bg-cream-light p-6 text-ink dark:border-cream-light ${className}`}>
      {children}
      {footer && (
        <>
          <div className="tear-line my-4" />
          {footer}
        </>
      )}
    </Tag>
  )
}
