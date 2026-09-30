# Progress – Talkies

## Last session

- Date: 2026-09-30 (second session)
- Done: **U-01 sign up + verify email** and **U-02 login / logout + tokens**.
- U-02 details:
  - New packages (added to requirements Section 2): `jsonwebtoken` 9.0.3, `cookie-parser` 1.4.7.
  - Refresh token = random value stored hashed (no JWT), so `JWT_REFRESH_SECRET` was removed from `.env.example` and `.env`; SEC-07 updated. A random dev `JWT_ACCESS_SECRET` was put in your `.env`. The server refuses to start without it (min 32 characters).
  - `config/auth.js`: access token 15 min, refresh 7 days (BR-19), cookie `talkies_rt` (httpOnly, sameSite strict, path `/api/auth`, secure in production), bcrypt rounds. **The lifetimes move to the settings collection with A-05 (Phase 2).**
  - `controllers/session.js`: `POST /api/auth/login` (same 401 for wrong email / wrong password, dummy hash so both take the same time; 403 not verified / blocked only after a correct password), `/refresh` (rotation, atomic), `/logout`. BR-17 in `rateLimits.js`: only wrong logins (401) count, 5 per 15 min per email + IP.
  - `middleware/auth.js` `requireAuth` (401 `UNAUTHORIZED` / `TOKEN_EXPIRED`, loads the user every request, blocked → 403). `GET /api/me`. `utils/publicUser.js`.
  - Client: `store/authStore.js` (token in memory only), `apiFetch` refreshes once on `TOKEN_EXPIRED` (one shared refresh), "Interval over!" when it fails, `AuthManager` restores the login on page load, `/login` page, "Log in" button on the Email verified page, links between sign up and login, `AuthStatus` ("Logged in as … · Log out") on the test Home page.
  - Tests: **61 pass** (client 16: theme 9 + token refresh 7; server 45: new `auth.session.test.js` with 16 tests, T-01 part). Checked by hand: verify link → Log in → wrong password message → login → reload (still logged in) → log out → reload (still logged out).
- Earlier today: Phase 0 (tasks 0.6 to 0.11) done.

## Next step

- **U-03 Forgot password** (E-02, reset link 30 min): forgot / reset endpoints, pages, "Forgot password?" link on the login page. After reset: all devices logged out.
- Add `SEED_PASSWORD=` to your own `.env` (needed once the seed makes test logins).
- Later (your choice when): Postmark account, then `POSTMARK_API_KEY` and `EMAIL_FROM` in `.env`.
- Not done (you can decide later): `/api/health` showing database status.

## Known bugs

- (none yet)

## Notes for later

- Token lifetimes (15 min / 7 days) are in `server/src/config/auth.js` for now; move them to the settings collection with A-05 (Phase 2).
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
- [x] U-02 Login / logout + tokens
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
