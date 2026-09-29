# Progress – Talkies

## Last session

- Date: 2026-09-29
- Done: Task 0.5. Tailwind v4.3.3 (`tailwindcss` + `@tailwindcss/vite`) in the client. Tailwind v4 has no `tailwind.config.js`: the theme lives in `client/src/theme/theme.css` inside `@theme { }` (colours UI-01, fonts UI-03, radius UI-05). This gives classes like `bg-maroon`, `font-heading`, `rounded-card` and CSS variables like `var(--color-maroon)`. Base style: cream page, ink text, Courier Prime body. Night show (UI-02) follows the phone/browser dark setting (`prefers-color-scheme`). Own classes: `tear-line` and `stamp`. Google Fonts (Rye, Special Elite, Courier Prime) linked in `client/index.html`. Empty `client/src/theme/motion.js`. `HomePage.jsx` is a theme test page for now. Build and lint pass.
- Notes: never use gold text on cream (fails 4.5:1 contrast); in dark mode headings and stamps use gold instead of maroon. Paper texture (UI-04) is left for later, only on big panels, never behind small text.
- Earlier: 0.3 client (Vite 8 + React 19 + React Router 8), 0.4 server (Express 5, ES modules, `GET /api/health`).
- Decisions: JavaScript (not TypeScript). Server uses ES modules. Tests use Vitest instead of Jest. No `nodemon` (use `node --watch`) and no `dotenv` (Node 24 reads `.env` itself). `concurrently` is approved; add it when the root `package.json` is made.

## Next step

- Phase 0, task 0.6: MongoDB connection + `.env.example`.
- Also soon: root `package.json` with `concurrently` so `npm run dev` runs client + server together.
- Developer to check the theme test page in the browser (light and dark mode).

## Known bugs

- (none yet)

## Open questions

- [ ] Intro: Curtain then Projector, or only one? (until decided: build both components, use Curtain only – as in requirements.md Section 17)
- [ ] Commission % starting value
- [ ] GST rates and HSN/SAC codes (confirm with a CA)
- [ ] Hosting for the test URL

---

## Phase 0 – Setup
- [x] 0.1 Folder structure + `git init` + first commit (15.1)
- [x] 0.2 `CLAUDE.md` + `docs/progress.md` in place
- [x] 0.3 Client: Vite + React + React Router
- [x] 0.4 Server: Express + folder structure
- [x] 0.5 Tailwind + Talkies theme colours + 3 Google Fonts (UI-01 to UI-05)
- [ ] 0.6 MongoDB connection + `.env.example`
- [ ] 0.7 Write `docs/database.md` (collections, fields, indexes)
- [ ] 0.8 Write `docs/api.md` (all endpoints)
- [ ] 0.9 Developer reviews database.md and api.md
- [ ] 0.10 Seed script skeleton (`npm run seed`)
- [ ] 0.11 Test setup (Vitest + Supertest + mongodb-memory-server)

## Phase 1 – Auth and roles
- [ ] U-01 Sign up + verify email
- [ ] U-02 Login / logout + tokens
- [ ] U-03 Forgot password
- [ ] O-01 Owner register (Pending)
- [ ] S-01 Staff login
- [ ] ROLE-01 to ROLE-06 role + ownership middleware
- [ ] Basic vintage layout: header, footer, buttons, cards
- [ ] T-01 tests

## Phase 2 – Admin + owner setup
- [ ] A-02 Movies
- [ ] A-03 Owner approvals
- [ ] A-04 Theatre approvals
- [ ] A-05 Platform settings
- [ ] O-03 Theatres
- [ ] O-04 Screens + seat layout editor
- [ ] O-07 Canteen items
- [ ] O-05 Shows (labels BR-22, end time BR-10, overlap check)
- [ ] T-08 test

## Phase 3 – User browsing
- [ ] U-04 City
- [ ] U-05 Home
- [ ] U-06 Search + filters, SF-08
- [ ] U-07 Movie details
- [ ] U-08 Age warning
- [ ] U-09 Show list

## Phase 4 – Seats
- [ ] UI-20 Box office window
- [ ] UI-21 Chair seat + UI-22 class names
- [ ] U-10 Live seat map (Socket.io)
- [ ] U-12 Seat hold + timer
- [ ] JOB-01
- [ ] NF-04 colour-blind marks
- [ ] T-02, T-03 tests

## Phase 5 – Booking + payment
- [ ] U-13 Food
- [ ] U-14 Summary
- [ ] U-15 + A-06 Coupons
- [ ] U-16 Mock payment (PAY-01 to PAY-04)
- [ ] U-17 QR ticket + PDF
- [ ] GST invoice (11.3)
- [ ] E-01 to E-03 emails
- [ ] JOB-02
- [ ] T-04, T-05 tests

## Phase 6 – Album + cancellations
- [ ] U-18 Ticket album
- [ ] U-20 Cancel booking
- [ ] O-06 Cancel show
- [ ] JOB-04, E-04, E-05
- [ ] T-06 test

## Phase 7 – Gate + canteen counter
- [ ] S-02 to S-05 Scanner + verify
- [ ] O-09 Staff accounts
- [ ] O-10 Check-in report
- [ ] O-11 Food pickup
- [ ] T-07 test

## Phase 8 – Dashboards + money
- [ ] O-02 Owner dashboard
- [ ] A-01 Admin dashboard
- [ ] O-13 + A-10 Reports
- [ ] O-14 + A-09 Payouts, JOB-06
- [ ] A-07 Users
- [ ] A-08 All bookings
- [ ] A-14 Audit log

## Phase 9 – Special features
- [ ] SF-01 Show timing insights
- [ ] SF-02 Ticket transfer
- [ ] SF-03 Smart seat pick
- [ ] SF-04 Waitlist, JOB-03
- [ ] SF-05 Seat view preview
- [ ] SF-06 Food pickup time
- [ ] SF-07 Last-minute deals, JOB-05

## Phase 10 – Vintage polish
- [ ] UI-11 Curtain intro
- [ ] UI-12 Projector intro
- [ ] All animations in 16.4
- [ ] UI-36 Error pages, UI-44 Empty states
- [ ] U-24 Badges
- [ ] UI-26 Ticker + A-11 Banners
- [ ] UI-40 Sound, UI-41 Reduce motion

## Phase 11 – Extras
- [ ] U-23 Reviews + A-12 Moderation
- [ ] U-27 + A-13 Help desk
- [ ] U-28 Policy pages
- [ ] U-26 Delete account
- [ ] NF-01 Offline PWA
- [ ] NF-06 Slow phones

## Phase 12 – Final
- [ ] All tests pass (T-01 to T-08)
- [ ] Security check (Section 13)
- [ ] Deploy to a test URL
