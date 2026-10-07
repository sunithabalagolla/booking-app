// All animation timings live here (Section 16.4), in milliseconds.
export const motion = {
  themeFade: 500, // UI-02 Day show ↔ Night show cross-fade
  bulbCycle: 1200, // UI-14 marquee bulbs: one full round of blinking
  sepiaFade: 600, // UI-46 vintage poster → fully bright
  curtainSway: 7000, // UI-15 Stage: side curtains sway ±0.7°, back and forth
  grainJitter: 400, // UI-45 film grain moves every 0.4 s
  tickerLoop: 30000, // UI-26 ticker: one full loop right → left
  spotlightSweep: 9000, // UI-15 banner spotlight: left → right (then back)
  neonFlicker: 5000, // UI-15 "NOW SHOWING" flicker: one dip every ~5 s
  riseIn: 700, // UI-15 chips and cards fade up on page load
  riseStagger: 120, // … one after another
  intervalFade: 400, // UI-33 Interval card fades in (CSS .interval-card)
  seatFlip: 400, // UI-21 seat cushion swings down / up with a small bounce (changed 2026-10-05, was 280) (CSS in theme.css .seat-cushion)
  filmReel: 1000, // UI-32 payment "Processing…" reel: one turn (CSS .film-reel)
  paymentMinimum: 2000, // PAY-02: "Processing…" shows at least this long
  ticketsSwing: 4000, // UI-20 "TICKETS" board swings once back and forth (CSS .tickets-board)
  ticketTear: 800, // UI-34 counterfoil tears off on Booking confirmed (CSS .ticket-stub)
  ticketTearDelay: 300, // … starts after this
}
