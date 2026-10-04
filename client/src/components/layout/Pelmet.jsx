// UI-15 "Stage": full-width velvet pelmet (valance) at the top: velvet band
// (34 px, phones 22 px), 3 px gold line, scallops (CSS in theme.css). Decoration only.
export default function Pelmet() {
  return (
    // In front of the side curtains (z-30), so the valance runs across the full width
    <div aria-hidden="true" className="relative z-[35]">
      <div className="velvet h-[22px] md:h-[34px]" />
      <div className="h-[3px] bg-gold" />
      <div className="pelmet-scallops" />
    </div>
  )
}
