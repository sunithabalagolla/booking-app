# Progress – Talkies

## Last session

- Date: 2026-09-30
- Done: committed 0.6. Task 0.7: wrote `docs/database.md` (22 collections, fields, indexes, transactions, seat locking rules).
- Docker MongoDB is now a single-node replica set `rs0` (needed for transactions). Container recreated, same volume. `MONGODB_URI` now ends with `?replicaSet=rs0` (`.env` and `.env.example`). Checked: a transaction works, server connects, `/api/health` 200. `CLAUDE.md` commands updated.
- Requirements updated: fixed city list in settings (seeded), owners pick from it (O-03), users see only cities with approved theatres (U-04); separate `bankaccounts` collection; replica set + `MongoMemoryReplSet` for tests (Section 2, 15.2, 15.5, 17).
- Review answers (all 8 questions) written in `database.md` Section 6 + `requirements.md` (BR-03, BR-11, BR-16, BR-20, U-01, A-06, A-11, S-02, 11.3, GST-02, Section 17). New `database.md` Section 2a: prices include GST, how GST is calculated back.
- Task 0.8: wrote `docs/api.md` (rules, error format, rate limits, all endpoints by role, Socket.io events). Requirements: Gate Staff can also use the food pickup screen (Section 3, O-11); "Resend verify email" max 3 per hour (U-01, SEC-03).
- Task 0.9 review done. Decisions written in `api.md` Section 13 and `requirements.md` (O-01, O-05, SF-04, SEC-03, Section 17); waitlist offer hold also in `database.md` (5.10, 5.17).
- Task 0.10: seed script skeleton. `server/src/seed/index.js` runs the steps in `seed/steps/index.js` (empty for now; steps added phase by phase), `--reset` drops all collections, refuses a non-local `MONGODB_URI` unless `--yes`. `seed/sample.js`: `isSample: true` marker + `SEED_PASSWORD` from `.env`. Root `package.json`: `npm run dev` (client + server with `concurrently` 10.0.5, dev dependency) and `npm run seed`. Checked: seed, reset, Atlas-like URI refused, both apps start with `npm run dev`.
- Task 0.11: test setup. Vitest 5.0.2 (client + server), Supertest 7.3.0, mongodb-memory-server 11.3.0 (dev dependencies). `npm test` from the root runs both. Server: one in-memory `MongoMemoryReplSet` (MongoDB 8.3.11) per run, test files one after another. Tests: client 9 (UI-02 `getAutoTheme`, `resolveTheme`, `loadThemeChoice`), server 12 (health + 404, seed safety `isLocalUri`, transaction commit / abort). **All 21 pass.** **Phase 0 done.**
- Seat checks must always check `expiresAt > now` (TTL deletes only about every 60 s). Written in `database.md` Section 3.

## Next step

- **Phase 1 – Auth and roles**, first task: U-01 sign up + verify email (with resend, max 3 per hour). Start with the `users` + `authtokens` models, the error shape (`api.md` 1.5, also fixes the `/api` 404 answer) and the rate limit config file (`server/src/config/rateLimits.js`).
- Add `SEED_PASSWORD=` to your own `.env` (needed once the seed makes test logins, Phase 1).
- Not done (you can decide later): `/api/health` showing database status.

## Known bugs

- (none yet)

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
