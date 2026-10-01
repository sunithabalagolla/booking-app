// NF-03: keyboard users can jump over the header straight to the page content
export default function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-btn bg-maroon px-4 py-2 text-cream focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to content
    </a>
  )
}
