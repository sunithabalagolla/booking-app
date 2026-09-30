# Progress – Talkies

## Last session

- Date: 2026-09-30 (second session)
- Done: **U-01 sign up + verify email** (first task of Phase 1).
  - Server foundations for all later tasks: request ID (`X-Request-Id`), `AppError` + error middleware (one error shape, api.md 1.5; `/api` 404 now uses it), Zod `validate()` middleware (refuses `$` / `.` keys, SEC-06), rate limits in one file `server/src/config/rateLimits.js` (SEC-03).
  - Models `User` (database.md 5.1, all fields) and `AuthToken` (5.2, TTL index).
  - Email service `services/email/`: console email now (no `POSTMARK_API_KEY`), Postmark when the key is set. E-01 template in the vintage style (user text is HTML-escaped).
  - `POST /api/auth/signup` (bcrypt 12 rounds, 409 `EMAIL_TAKEN`, 5 per hour per IP), `/verify-email` (works once, 24 h; opening it twice says "already verified"), `/resend-verify` (always 200, old link stops working, max 3 per hour per email).
  - Client: Vite proxy `/api` → 5000, TanStack Query, `api/client.js` fetch helper (`ApiError`), pages `/signup`, `/check-email`, `/verify-email` with small UI parts `PaperCard`, `TextField` (labels + linked errors, NF-03), `Button`, `ResendVerify`.
  - New packages (all Section 2): server `zod` 4.6.5, `bcrypt` 6.0.0, `postmark` 5.1.0, `express-rate-limit` 8.7.0; client `zod`, `@tanstack/react-query` 5.104.0. `.env.example`: `CLIENT_URL`, `EMAIL_FROM`.
  - New folders `server/src/validation/` and `client/src/validation/` (Zod schemas; same password rule on both sides – keep them the same). `server/src/utils/` for `AppError` and tokens.
  - Password max 72 characters (bcrypt uses only the first 72 bytes).
  - Tests: **38 pass** (client 9, server 29; new `auth.signup.test.js` with 17 tests). Also checked by hand with the real apps: sign up → console email → link verifies; form errors, `EMAIL_TAKEN` message, broken link page, Night show theme.
- Earlier today: Phase 0 (tasks 0.6 to 0.11) done.

## Next step

- **U-02 Login / logout + tokens** (BR-17, BR-19, SEC-02): login blocks unverified and blocked users, access token + refresh cookie with rotation, logout. Add the login page and point the "Email verified" button to it.
- Add `SEED_PASSWORD=` to your own `.env` (needed once the seed makes test logins).
- Later (Postmark, your choice when): create the Postmark account, set `POSTMARK_API_KEY` and `EMAIL_FROM` in `.env`.
- Not done (you can decide later): `/api/health` showing database status.

## Known bugs

- (none yet)

## Notes for later

- Rate limit counts are kept in server memory (`express-rate-limit` MemoryStore): they reset when the server restarts, and do not work across several server copies. OK for now; look again at deploy time (Phase 12).

## Open questions

- [ ] Commission % starting value
- [ ] GST rates and HSN/SAC codes (confirm with a CA)
- [ ] Hosting for the test URL
- [x] 4 API questions answered (2026-09-30): owners verify email, rate limits OK in one config file, no show edits after bookings (except deals), waitlist offer seat held for that person. See `api.md` Section 13
- [x] Buyer state for GST: decided, theatre's state, CGST + SGST for all lines (2026-09-30)
- [x] 7 database questions answered (2026-09-30): verify link 24 h, prices include GST (calculated back), coupons tickets only, booking number TK + 8, credit note series CN/, coupon not given back after cancel, no city = all cities. See `database.md` Section 6

---

## UI-02 theme switch – later tasks
- [x] Add `theme` field (auto / day / night) to the users collection in `docs/database.md` (task 0.7)
- [x] Add saving the theme choice to the profile API in `docs/api.md` (task 0.8): `PATCH /api/me/prefs`
- [x] Tests for `getAutoTheme`: 5:59 AM → Night, 6:00 AM → Day, 6:59 PM → Day, 7:00 PM → Night (task 0.11)
- [ ] Move `ThemeSwitch` from the test Home page into the real header (Phase 1, basic vintage layout)
- [ ] Save the choice in the user profile when logged in; profile choice wins over localStorage (Phase 1 login + U-25)
- [ ] Theme choice in Profile (U-25 / UI-29)
- [ ] Reduce motion setting in Profile also turns off the theme fade (UI-41, Phase 10). Until then it follows the phone setting

## Phase 0 – Setup ✅ done
- [x] 0.1 Folder structure + `git init` + first commit (15.1)
- [x] 0.2 `CLAUDE.md` + `docs/progress.md` in place
- [x] 0.3 Client: Vite + React + React Router
- [x] 0.4 Server: Express + folder structure
- [x] 0.5 Tailwind + Talkies theme colours + 3 Google Fonts (UI-01 to UI-05)
- [x] UI-02 Theme switch Auto / Day show / Night show (localStorage for guests)
- [x] 0.6 MongoDB connection + `.env.example`
- [x] 0.7 Write `docs/database.md` (collections, fields, indexes)
- [x] 0.8 Write `docs/api.md` (all endpoints)
- [x] 0.9 Developer reviews database.md and api.md
- [x] 0.10 Seed script skeleton (`npm run seed`)
- [x] 0.11 Test setup (Vitest + Supertest + mongodb-memory-server, use `MongoMemoryReplSet` for transactions)

**Phase 0 done (2026-09-30).**

## Phase 1 – Auth and roles
- [x] U-01 Sign up + verify email (with resend, max 3 per hour)
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
- [ ] UI-12 Projector intro, then UI-11 Curtain intro (order decided; one Skip skips both)
- [ ] All animations in 16.4
- [ ] UI-36 Error pages, UI-44 Empty states
- [ ] U-24 Badges
- [ ] UI-26 Ticker + A-11 Banners
- [ ] UI-40 Sound, UI-41 Reduce motion
- [ ] UI-45 Film grain + flicker
- [ ] UI-46 Sepia posters (full colour on hover / on scroll into view on phones)
- [ ] UI-47 "Behind the scenes" blueprint page (footer link)

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
- [ ] Create MongoDB Atlas free tier cluster (developer creates the account)
- [ ] Set `MONGODB_URI` in the deployed `.env` to the Atlas link (no code changes)
- [ ] Run the seed script once on Atlas (`npm run seed`)
- [ ] Deploy to a test URL
