// UI-15 "Stage": velvet side curtains (CSS in theme.css). Below 1280 px a thin 12 px
// velvet edge; from 1280 px a gathered curtain with a gold rope tie-back that sways
// slowly (stops with reduce motion). Decoration only: hidden from screen readers,
// never clickable.
function Curtain({ side }) {
  return (
    <div aria-hidden="true" className={`side-curtain side-curtain-${side}`}>
      <div className="curtain-cloth velvet" />
      <div className="curtain-tie" />
    </div>
  )
}

export default function SideCurtains() {
  return (
    <>
      <Curtain side="left" />
      <Curtain side="right" />
    </>
  )
}
