// Very wide screens (1440 px+): red velvet curtains on the left and right edges
// (CSS in theme.css). Decoration only: hidden from screen readers, never clickable.
export default function SideCurtains() {
  return (
    <>
      <div aria-hidden="true" className="side-curtain side-curtain-left" />
      <div aria-hidden="true" className="side-curtain side-curtain-right" />
    </>
  )
}
