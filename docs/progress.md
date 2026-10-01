# Progress – Talkies

## Last session

- Date: 2026-10-01
- Done: **`/api/health` database status** (separate commit), **U-03 forgot / reset password**, the **passwordChangedAt** fix, **O-01 owner register** and **S-01 staff login** + seed test logins.
- Health: `200 { status: 'ok', db: 'connected' }`, `503 { status: 'error', db: 'disconnected' }`. `api.md` updated, test added.
- U-03 details:
  - `controllers/password.js`: `POST /api/auth/forgot-password` (always the same 200 answer; sends E-02 only for an active, not deleted account; old reset links deleted, so only the newest works; 3 per hour per email in `rateLimits.js`) and `POST /api/auth/reset-password` (BR-18 password, link used up atomically and only once, 30 min in `config/auth.js` `RESET_LINK_MINUTES`).
  - After a reset: all refresh tokens of the user deleted (all devices logged out). The reset also marks the email as verified (your decision). Works for all 4 roles (your decision). Blocked / deleted account → link refused.
  - E-02 template `resetPasswordTemplate` (vintage email style).
  - Client: "Forgot password?" link on the login page (takes the typed email along), `/forgot-password` page, `/reset-password` page (new password twice, "Get a new link" when the link does not work, "Log in" after success).
  - Tests: **78 pass** (client 19: new `validation/auth.test.js` 3; server 59: health 3, new `auth.reset.test.js` 13). Client lint + build OK. Not checked by hand in the browser yet.
- Gap fixed (your request): new `users.passwordChangedAt`, set on reset. `requireAuth` refuses an access token made before it (`401 TOKEN_EXPIRED`), so a reset logs out all devices at once. Tests now **79 pass** (server 60). Later `POST /me/password` (U-25) must set it too.
- O-01 details (your decisions 2026-10-01):
  - `POST /api/auth/owner-signup` (`controllers/auth.js`, shares `createAccount` with U-01): owner with `approvalStatus: pending`, `emailVerified: false`, sends E-01. Same 409 `EMAIL_TAKEN`. Shares the sign up rate limit (5 per hour per IP, user + owner together).
  - Phone rule (added to requirements O-01, api.md, database.md): Indian mobile, 10 digits starting 6–9, optional `+91`, saved as 10 digits. Business name max 120.
  - Client: `/owner/signup` page, "Own a theatre? Register as a theatre owner" link on the sign up page, "Check your email" page has owner text, `/owner/pending` page (Pending stamp in dark mustard, Rejected stamp in maroon with the reason, Log out). After login a pending / rejected owner goes to `/owner/pending` (`needsApproval` in `authStore.js`). Approved owners go to Home until the owner dashboard exists. New colour token `mustard` (#8A5A00, UI-30).
  - Tests: **90 pass** (client 22: new `validation/owner.test.js` 3; server 68: new `auth.owner.test.js` 8). Client lint + build OK. Not checked by hand in the browser yet.
- S-01 details:
  - Staff use the same login (no new endpoint). Client: `homePathFor(user, from)` in `authStore.js` decides where to go after login: staff → `/staff/scan` always, pending / rejected owner → `/owner/pending`, others → where they came from. `/staff/scan` placeholder page (ticket window frame, no intro, Log out); the real scanner is S-02 (Phase 7).
  - Seed step `users` (`server/src/seed/steps/users.js`, your decision): User, Owner (approved), Gate Staff, Admin, all with `SEED_PASSWORD`, emails `user@ / owner@ / staff@ / admin@talkies.test`. Upsert by email, so the seed can run again. Prints the logins (not the password). Ran it once on Docker: OK.
  - `isSample: Boolean` added to the User model (the 0.10 seed design marks sample data with it; Mongoose dropped it before). database.md: "Sample data" rule.
  - New rule (your decision, in requirements ROLE-05 + A-07): if an owner is blocked, their Gate Staff also cannot log in. **Build it with A-07.**
  - Tests: **98 pass** (client 25: `store/authRoutes.test.js` 6 (was `validation/owner.test.js`); server 73: new `auth.staff.test.js` 3, `seed.users.test.js` 2). Lint + build OK. Not checked by hand in the browser yet.
- Earlier (2026-09-30): Phase 0, U-01, U-02.

## Next step

- **ROLE-01 to ROLE-06** role + ownership middleware (next in Phase 1).
- Try by hand once: U-03 (Log in → Forgot password? → link from the server console → new password → log in) and O-01 (Sign up → Register as a theatre owner → verify link from the console → log in → Waiting for approval page), and S-01 (`npm run seed`, log in as `staff@talkies.test` → Gate scanner page).
- Later (your choice when): Postmark account, then `POSTMARK_API_KEY` and `EMAIL_FROM` in `.env`.

## Known bugs

- (none yet)

## Notes for later

- `/api/health` shows database status: decided **yes** in task 0.6 (written down 2026-10-01). Built 2026-10-01: `200 { status: 'ok', db: 'connected' }`, `503 { status: 'error', db: 'disconnected' }`.

- Token lifetimes (15 min / 7 days) are in `server/src/config/auth.js` for now; move them to the settings collection with A-05 (Phase 2).
- Rate limit counts are kept in server memory (`express-rate-limit` MemoryStore): they reset when the server restarts, and do not work across several server copies. OK for now; look again at deploy time (Phase 12).

- **Seeded Gate Staff has no theatres yet** (`staff.theatreIds: []`). ROLE-05 says one or more; theatres only exist from Phase 2 (O-03). When the theatres seed step is added, link `staff@talkies.test` to the sample owner's theatres.
- Owner blocked → their Gate Staff cannot log in (ROLE-05, A-07). Check it at login, refresh and in `requireAuth`. Build with A-07 (Phase 8).

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
- [x] U-03 Forgot password (reset link 30 min, all devices logged out, also verifies the email)
- [x] O-01 Owner register (Pending, phone rule, waiting for approval page)
- [x] S-01 Staff login (opens to `/staff/scan` placeholder; seed test logins for all 4 roles)
- [ ] ROLE-01 to ROLE-06 role + ownership middleware
- [ ] Basic vintage layout: header, footer, buttons, cards
  - [ ] Footer link "For theatre owners" → `/owner/signup` (O-01, your request 2026-10-01)
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
- [ ] A-07 Users (+ blocked owner also stops their Gate Staff, ROLE-05)
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
