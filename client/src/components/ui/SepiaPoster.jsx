import { useEffect, useRef, useState } from 'react'

// UI-46 sepia poster: shown in sepia; the full-colour picture fades in on top
// (opacity only, 600 ms from motion.js). Desktop: hover / keyboard focus on the
// parent link (`group`, CSS in theme.css). Phones (no hover): by itself once it
// scrolls into view, then it stays in colour. Reduce motion: instant (theme.css).
// The browser loads the image once; both layers use it.

const noHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches

export default function SepiaPoster({ src, alt = '', className = '', eager = false }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!noHover() || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const loading = eager ? 'eager' : 'lazy' // NF-09: posters lower down load later
  return (
    <div ref={ref} className={`relative overflow-hidden bg-stage ${className}`}>
      <img src={src} alt={alt} loading={loading} className="h-full w-full object-cover sepia" />
      <img src={src} alt="" aria-hidden="true" loading={loading} data-inview={inView} className="poster-colour absolute inset-0 h-full w-full object-cover" />
    </div>
  )
}
