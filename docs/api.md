# Talkies – API design

Version 1 · 2026-09-30 · Task 0.8 · **Developer review in task 0.9 before Phase 1**

Express REST API + Socket.io. Made from `docs/requirements.md` and `docs/database.md`; the requirement IDs are in the tables.

---

## 1. Rules for all endpoints

### 1.1 Basics
- Base path: `/api`. Request and response bodies are JSON (except file downloads and uploads).
- **Money** in paise (whole numbers), the same as the database. **Dates** are ISO 8601 strings in UTC (`2026-10-03T09:00:00.000Z`); the client shows IST. A date without time (for example `?date=2026-10-03`) means that **day in IST**.
- IDs are MongoDB ObjectId strings. Invalid IDs → `400 VALIDATION_ERROR`.
- Every response has an `X-Request-Id` header. The server logs errors with this ID (NF-10).

### 1.2 Login tokens (BR-19, SEC-02)
- **Access token** (JWT, 15 min): sent by the client in the header `Authorization: Bearer <token>`. It holds only `userId` and `role`.
- **Refresh token** (7 days): only in an httpOnly cookie `talkies_rt` (`secure` in production, `sameSite: strict`, `path: /api/auth`). It is stored hashed in `authtokens`. Every refresh gives a **new** refresh token and deletes the old one (rotation).
- Access token expired → `401 TOKEN_EXPIRED` → the client calls `POST /api/auth/refresh` once and repeats the request. Refresh also fails → show "Interval over! Please log in again" (UI-36).
- The server loads the user on each request, so a blocked user (A-07) is stopped at once, even with a valid token.

### 1.3 Who can call (ROLE-01, ROLE-02)
The **"Who"** column in the tables:

| Who | Meaning |
| --- | --- |
| Guest | No login needed (logged-in users can also call it) |
| Any | Any logged-in role |
| User | Role `user` |
| Owner | Role `owner` **and** `owner.approvalStatus: approved` (ROLE-03). Pending / rejected owners get `403 OWNER_NOT_APPROVED` |
| Owner (any) | Role `owner`, any approval status |
| Staff | Role `staff` |
| Admin | Role `admin` |

- The path prefix sets the role check once for the whole group: `/api/owner/*` → Owner, `/api/staff/*` → Staff, `/api/admin/*` → Admin.
- **Own** in the notes = ownership check (ROLE-02): the theatre / screen / show / booking must belong to this owner, or be one of this staff's theatres, or be this user's booking. When it does not → `404 NOT_FOUND` (we do not tell others that the item exists).
- Wrong role → `403 FORBIDDEN` (T-01).

### 1.4 Input (SEC-06, SEC-10)
- Every body, query and param is checked with a Zod schema. Unknown fields are dropped. Keys with `$` or `.` → `400`.
- The client **never sends prices, totals or discounts**. It sends only IDs, seat IDs, quantities and codes. The backend calculates every amount (SEC-10).

### 1.5 Errors
All errors have the same shape:

```json
{ "error": { "code": "SEAT_TAKEN", "message": "Seat F4 was just taken. Please pick another seat.", "details": { "seatIds": ["F4"] }, "requestId": "a1b2c3" } }
```

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Input failed the Zod check. `details` = field → message |
| 400 | `RULE_BROKEN` | A business rule says no. `details.rule` = the BR ID, e.g. `BR-04` cancel cutoff passed, `BR-02` too many seats |
| 400 | `PAYMENT_FAILED` | Mock payment failed (PAY-03). The hold stays, so the user can try again |
| 400 | `COUPON_INVALID` | `details.reason`: `expired` · `not_started` · `used_up` · `user_limit` · `min_amount` · `wrong_city` · `wrong_theatre` · `with_deal` |
| 401 | `UNAUTHORIZED` / `TOKEN_EXPIRED` | No token / expired token |
| 401 | `INVALID_LOGIN` | Wrong email or password (same message for both) |
| 403 | `EMAIL_NOT_VERIFIED` / `ACCOUNT_BLOCKED` / `OWNER_NOT_APPROVED` / `FORBIDDEN` | |
| 404 | `NOT_FOUND` | Missing, or not yours |
| 409 | `SEAT_TAKEN` · `HOLD_EXPIRED` · `SHOW_OVERLAP` · `EMAIL_TAKEN` · `ALREADY_EXISTS` · `IN_USE` | Conflicts (see each endpoint) |
| 429 | `RATE_LIMITED` | Too many requests. `Retry-After` header set |
| 500 | `SERVER_ERROR` | Friendly message; the client shows the UI-36 page |

> The current `/api` 404 answer in `server/src/app.js` (`{ message }`) changes to this shape in Phase 1.

### 1.6 Lists
- Query: `?page=1&limit=20` (max `100`). Response: `{ "items": [...], "page": 1, "limit": 20, "total": 134 }`.

### 1.7 Rate limits (SEC-03)
`express-rate-limit`. **All numbers live in one config file: `server/src/config/rateLimits.js`.** Values marked *(start)* are start values agreed in the review (not in the requirements); they can be changed in that file.

| Endpoint | Limit | Key |
| --- | --- | --- |
| `POST /auth/login` | 5 wrong logins / 15 min (BR-17) | email + IP |
| `POST /auth/resend-verify` | 3 / hour (U-01) | email |
| `POST /auth/signup`, `POST /auth/owner-signup` | 5 / hour *(start)* | IP |
| `POST /auth/forgot-password` | 3 / hour *(start)* | email |
| Seat hold, food, coupon | 30 / 10 min *(start)* | user |
| Payment (create order, pay, verify) | 10 / 10 min *(start)* | user |
| Ticket transfer, issues, reviews | 10 / hour *(start)* | user |
| Gate scan, food pickup | 60 / min *(start)* | staff / owner |
| Everything else | 300 / 15 min *(start)* | IP |

---

## 2. Health

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/api/health` | Guest | `200 { status: 'ok', db: 'connected' }`. `503 { status: 'error', db: 'disconnected' }` when MongoDB is not connected |

---

## 3. Auth – `/api/auth` (U-01 to U-03, O-01, S-01)

| Method | Path | Who | Body | Result / notes |
| --- | --- | --- | --- | --- |
| POST | `/signup` | Guest | `name, email, password` | `201`. Password BR-18. Sends E-01 (verify link, 24 h). `409 EMAIL_TAKEN` if the email exists. U-01 |
| POST | `/verify-email` | Guest | `token` | `200` → `emailVerified: true`. Used / expired link → `400 RULE_BROKEN` with a "Resend" hint |
| POST | `/resend-verify` | Guest | `email` | Always `200` (does not tell if the email exists). Deletes old verify links, sends a new E-01. Max 3 / hour (U-01, SEC-03) |
| POST | `/owner-signup` | Guest | `name, email, phone, businessName, password` | `201`. Owner with `approvalStatus: pending` (O-01, ROLE-03). Sends E-01: owners must verify the email before login, same as users (resend works too) |
| POST | `/login` | Guest | `email, password` | `200 { accessToken, user }` + sets `talkies_rt` cookie. `401 INVALID_LOGIN`, `403 EMAIL_NOT_VERIFIED`, `403 ACCOUNT_BLOCKED`. Same login for all 4 roles (S-01). Pending owners can log in (they see a "waiting for approval" page) |
| POST | `/refresh` | Guest (cookie) | — | `200 { accessToken }` + new cookie. No / bad cookie → `401` |
| POST | `/logout` | Guest (cookie) | — | `204`. Deletes the refresh token and clears the cookie |
| POST | `/forgot-password` | Guest | `email` | Always `200`. Sends E-02 (reset link, 30 min) if the account exists |
| POST | `/reset-password` | Guest | `token, password` | `200`. Logs out all devices (deletes all refresh tokens) |

`user` in responses = `{ id, name, email, role, phone, prefs, badges, enteredCount, owner: { businessName, approvalStatus, rejectReason }, staff: { theatreIds } }` (only the parts for that role; never `passwordHash`).

---

## 4. My account – `/api/me` (U-25, U-26, UI-02)

| Method | Path | Who | Body | Result / notes |
| --- | --- | --- | --- | --- |
| GET | `/me` | Any | — | `user` (includes badges, U-24) |
| PATCH | `/me` | Any | `name?, phone?` | U-25 |
| PATCH | `/me/prefs` | Any | `theme?` (`auto` · `day` · `night`), `sound?`, `reduceMotion?` | UI-02, UI-40, UI-41. Profile choice wins over localStorage |
| POST | `/me/password` | Any | `currentPassword, newPassword` | Logs out other devices |
| DELETE | `/me` | User | `password` | U-26: personal data removed, invoices kept without name / email. Logs out |

---

## 5. Public browsing (guests) – U-04 to U-09, SF-08, A-11

| Method | Path | Who | Query | Result / notes |
| --- | --- | --- | --- | --- |
| GET | `/api/cities` | Guest | — | `[{ code, name }]`: only cities with approved theatres (U-04) |
| GET | `/api/settings/public` | Guest | — | Values the UI needs: `holdMinutes, maxSeatsPerBooking, convenienceFeePaise, cancelCutoffMinutes, userRefundTicketPercent, transferCutoffMinutes` |
| GET | `/api/banners` | Guest | `city, kind?` (`banner` · `ticker`) | Active now, for that city + no-city ones (A-11, UI-26) |
| GET | `/api/movies` | Guest | `city, status?` (`now_showing` · `coming_soon`), `q?, language?, genre?, format?` (`2D` · `3D`), `subtitles?, wheelchair?, parentBaby?`, page | U-05, U-06, SF-08. Filters combine (AND). `now_showing` + `city` = movies with a scheduled show in that city in the next 7 days. Format and SF-08 filters look at those shows |
| GET | `/api/movies/:id` | Guest | — | All movie fields (U-07). `inactive` → `404` |
| GET | `/api/movies/:id/reviews` | Guest | page | Not hidden only (A-12) |
| GET | `/api/movies/:id/shows` | Guest | `city, date` (IST day, today … +6), same filters as above | U-09: `[{ theatre: { id, name, address, amenities }, shows: [{ id, startAt, label, language, format, subtitles, tags, housefull, deal: { active, percent }, minPricePaise }] }]` |
| GET | `/api/shows/:id` | Guest | — | Show + movie + theatre + screen name + `layout` + `prices` (with class names). No seat states |
| GET | `/api/theatres/:id/food` | Guest | — | Canteen menu, in-stock items first (U-13, UI-24) |

---

## 6. Booking flow – User (U-10 to U-17, 9.2 to 9.4)

Login is needed from seat selection on (9.2).

| Method | Path | Who | Body / query | Result / notes |
| --- | --- | --- | --- | --- |
| GET | `/api/shows/:id/seats` | User | — | `{ taken: [{ seatId, status }] }` with `status` `held` · `booked`. Expired holds are shown as free (`expiresAt > now` check, database.md Section 3). Live changes come by Socket.io (Section 12) |
| POST | `/api/shows/:id/seat-suggestion` | User | `count` (1–10), `seatClass` | SF-03 / U-11: `{ groups: [[seatIds]] }` (1 group, or the best 2). Only a suggestion, nothing held (Phase 9) |
| POST | `/api/bookings/hold` | User | `showId, seatIds[]` | U-12. `201 { booking }` with `status: pending`, `holdExpiresAt`. One transaction: all seats or none. `409 SEAT_TAKEN` (`details.seatIds`). Max seats BR-02. Blocked / non-existing seat → `400`. Show started, cancelled or not live → `400 RULE_BROKEN`. If the user already has a `pending` booking for this show, it is released first |
| GET | `/api/bookings/:id` | User (own) | — | Full booking: seats, food, `pricing` (U-14 summary, always recalculated by the backend), `holdExpiresAt` (timer after refresh). Confirmed: also `qrDataUrl` and `bookingNumber` (U-17) |
| DELETE | `/api/bookings/:id/hold` | User (own) | — | Give up: seats free, `status: released` (9.2 "release seats") |
| PUT | `/api/bookings/:id/food` | User (own) | `items: [{ foodItemId, qty }]`, `pickup` (`before_movie` · `interval`) | U-13, SF-06. Replaces the food list. Only while `pending`. Out-of-stock item → `400`. Empty list = no food |
| PUT | `/api/bookings/:id/coupon` | User (own) | `code` | U-15, BR-16. Applies to tickets only. `400 COUPON_INVALID` with `reason`. Returns the new `pricing` |
| DELETE | `/api/bookings/:id/coupon` | User (own) | — | Removes the coupon |
| POST | `/api/bookings/:id/payments` | User (own) | — | PAY-01 `createOrder`: `201 { orderId, amountPaise }`. Amount from the backend. Hold expired → `409 HOLD_EXPIRED` |
| POST | `/api/mock-gateway/pay` | User | `orderId, method` + `upiId` / `card { number, expiry, cvv, name }` / `bank` | The **fake Razorpay** (PAY-02, PAY-03). Success: `{ paymentId, signature }`. Failure: `400 { code: 'PAYMENT_FAILED' }`, payment → `failed`. Card data is not stored. Lives in `services/payment/` and is swapped out for real Razorpay later |
| POST | `/api/payments/verify` | User | `orderId, paymentId, signature` | PAY-01 `verifySignature`. Bad signature → `400 RULE_BROKEN` (T-04). Good → the confirm **transaction** (database.md Section 2) → `200 { booking }`. Hold expired meanwhile → `409 HOLD_EXPIRED` and an automatic refund (JOB-02). Sends E-03 with the invoice PDF |
| GET | `/api/bookings` | User | `tab` (`upcoming` · `past`), page | U-18 ticket album. Includes tickets transferred away (shown as "Transferred"). Upcoming includes `qrDataUrl` (for offline, U-19) |
| GET | `/api/bookings/:id/ticket.pdf` | User (own) | — | U-17 PDF ticket |
| GET | `/api/invoices/:id/pdf` | User (own) · Owner (own theatre) · Admin | — | Invoice or credit note PDF (11.3, GST-02) |
| GET | `/api/bookings/:id/cancel-preview` | User (own) | — | U-20: `{ allowed, reason?, refundPaise, lines }` (BR-04, BR-05) |
| POST | `/api/bookings/:id/cancel` | User (own) | — | U-20, flow 9.5. Transaction: seats free, refund, credit note. Sends E-04. Starts a waitlist offer. After cutoff → `400 RULE_BROKEN` (`BR-04`) |
| POST | `/api/bookings/:id/transfer` | User (own) | `email` | SF-02, BR-15 (once, until 30 min before, not after Used). Old QR stops working at once. Friend has an account → moves now; no account → claim email. Sends E-06 |
| POST | `/api/transfers/claim` | User | `token` | The friend claims the ticket after sign up. The logged-in email must match the invited email |

---

## 7. Waitlist, reviews, help – User (SF-04, U-23, U-27)

| Method | Path | Who | Body | Result / notes |
| --- | --- | --- | --- | --- |
| POST | `/api/shows/:id/waitlist` | User | — | SF-04. Only when the show is Housefull. Max 1 per user per show → `409 ALREADY_EXISTS` |
| DELETE | `/api/shows/:id/waitlist` | User | — | Leave the waitlist |
| GET | `/api/me/waitlist` | User | — | My entries with status (`waiting` · `offered` + `offerExpiresAt` + the held `seatIds`) |

**Waitlist offer (SF-04):** a freed seat is held **only for the offered person** until `offerExpiresAt` (a `showseats` hold with `waitlistId`, see database.md 5.10). Other users see it as held. The offered person books with the normal `POST /api/bookings/hold`: their offered seats are allowed, and the offer hold becomes the booking hold. No booking in 10 minutes → JOB-03 holds the seat for the next person (E-07).
| POST | `/api/movies/:id/reviews` | User | `rating` (1–5), `text?` | U-23, BR-24: only with an "Entered" ticket for this movie, else `403`. One per movie → `409 ALREADY_EXISTS` |
| PATCH | `/api/reviews/:id` | User (own) | `rating?, text?` | Edit my review |
| POST | `/api/issues` | User | `message, bookingId?` | U-27. `bookingId` must be the user's |
| GET | `/api/issues` | User | page | My issues |
| GET | `/api/issues/:id` | User (own) | — | Issue + replies |

---

## 8. Theatre Owner – `/api/owner` (Section 6)

All paths below start with `/api/owner`. **Who = Owner (approved)** and **own** data only (ROLE-02), unless noted.

| Method | Path | Body / query | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | `theatreId?, date?` | O-02: tickets sold today, revenue today, seats filled %, today's entries, food sales. Live updates by Socket.io |
| GET | `/insights` | `theatreId?` | SF-01: seats filled % by show label and weekday, last 4 weeks + one tip (Phase 9) |
| GET | `/theatres` | — | My theatres with status |
| POST | `/theatres` | `name, cityCode, address, mapLink?, photos?, gstin, amenities` | O-03. Starts `pending` (ROLE-04). `cityCode` must be in `settings.cities` |
| GET · PATCH | `/theatres/:id` | same fields | Edit |
| GET | `/theatres/:id/screens` | — | |
| POST | `/theatres/:id/screens` | `name, format, cleaningBreakMinutes?, wheelchairFriendly, layout` | O-04. Layout checked: seat IDs unique, valid classes |
| GET · PATCH | `/screens/:id` | same fields | Layout edits do not change existing shows (they keep a copy) |
| GET | `/theatres/:id/food` | — | All items (also out of stock) |
| POST | `/theatres/:id/food` | `name, photoUrl?, pricePaise, isVeg, inStock, isCombo` | O-07. Price GST included |
| PATCH · DELETE | `/food/:id` | same fields | Old bookings keep their copy |
| GET | `/shows` | `theatreId?, screenId?, from?, to?`, page | |
| POST | `/shows` | `movieId, screenId, dates[]` (IST days), `startTime` (`HH:mm` IST), `language, format, subtitles, tags?, prices: [{ seatClass, pricePaise }]` | O-05. One show per date, all or none (transaction). End time BR-10, label BR-22. Overlap → `409 SHOW_OVERLAP` with `details.dates`. Theatre not approved → `400 RULE_BROKEN` (ROLE-04). Movie `inactive` → `400` |
| PATCH | `/shows/:id` | same fields (not `dates`) | Only while the show has **no** bookings (O-05), else `409 IN_USE` "cancel the show instead". Deal settings use `PUT /shows/:id/deal` and can always change |
| POST | `/shows/:id/cancel` | `reason` | O-06, flow 9.6. After start → `400 RULE_BROKEN` (BR-07). Refunds run in JOB-04, E-05 to every user |
| PUT | `/shows/:id/deal` | `enabled, percent` | O-12, BR-14 (max `dealMaxPercent`) |
| PUT | `/theatres/:id/deal` | `enabled, percent` | O-12 "for all shows" of the theatre (future shows) |
| GET | `/bookings` | `showId?, theatreId?, number?, from?, to?`, page | O-08: bookings of my shows, search by booking number, check-in status |
| GET | `/bookings/:id` | — | |
| GET | `/shows/:id/checkins` | — | O-10: booked vs Entered |
| GET | `/staff` | — | O-09 |
| POST | `/staff` | `name, email, password, theatreIds[]` | O-09, ROLE-05. `emailVerified: true`. `theatreIds` must be mine |
| PATCH | `/staff/:id` | `name?, theatreIds?, status?` (`active` · `blocked`) | Block / unblock, change theatres |
| GET | `/reports/sales` | `period` (`daily` · `weekly` · `monthly`), `from, to, theatreId?, format?` (`json` · `xlsx` · `pdf`) | O-13 |
| GET | `/reports/food` | same | O-13 |
| GET | `/reports/gst` | `month` (`2026-10`), `theatreId?, format?` | O-13, GST-03 |
| GET | `/payouts` | page | O-14: history and status |
| GET | `/payouts/:id` | — | Payout + its bookings and refunds (lines) |
| GET | `/bank-account` | — | O-14, SEC-12: `{ accountNumberLast4, updatedAt }` only (or `404` if not added yet). The full details are never sent back |
| PUT | `/bank-account` | `accountName, accountNumber, ifsc` | Saved encrypted in `bankaccounts` |

---

## 9. Gate Staff and food pickup (S-02 to S-05, O-11)

| Method | Path | Who | Body | Result / notes |
| --- | --- | --- | --- | --- |
| GET | `/api/staff/theatres` | Staff | — | My theatres (scanner header) |
| POST | `/api/staff/checkins` | Staff | `qrToken` **or** `bookingNumber` | S-03 checks in order: QR signature → booking is for my theatre → inside BR-08 → `confirmed` → not used. Then S-04: atomic mark Used + `enteredCount` +1 + badge check (U-24, E-08). Always `200`: `{ result: 'entered', booking: { movie, screen, seats, food } }` or `{ result: 'rejected', reason, usedAt? }`. `reason`: `bad_qr` · `wrong_theatre` · `too_early` · `too_late` · `cancelled` · `transferred` · `already_used` (T-07) |
| POST | `/api/food-pickup/lookup` | Owner (own theatre) · Staff (my theatre) | `qrToken` **or** `bookingNumber` | O-11: `{ bookingNumber, food, pickup, collectedAt? }` |
| POST | `/api/food-pickup/collect` | Owner (own theatre) · Staff (my theatre) | `qrToken` **or** `bookingNumber` | O-11: atomic, once only. Second time → `409 ALREADY_EXISTS` with `collectedAt` |

---

## 10. Admin – `/api/admin` (Section 7)

All paths below start with `/api/admin`. **Who = Admin.** Every change marked **(audit)** writes to `auditlogs` (A-14).

| Method | Path | Body / query | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | `date?` | A-01: tickets today, revenue, commission, top movies, top theatres, cities. Live updates by Socket.io |
| GET | `/movies` | `q?, status?`, page | A-02 |
| POST | `/movies` | `title, posterUrl, trailerUrl?, cast?, genres, languages, durationMinutes, certificate, releaseDate, status` | |
| PATCH | `/movies/:id` | same fields | Status `inactive` hides it from users and owners |
| DELETE | `/movies/:id` | — | Only if no shows and no bookings, else `409 IN_USE` "make it inactive" |
| GET | `/owners` | `approvalStatus?, q?`, page | A-03 |
| POST | `/owners/:id/approve` | — | (audit) E-09 |
| POST | `/owners/:id/reject` | `reason` | (audit) E-09 |
| GET | `/theatres` | `status?, cityCode?`, page | A-04 |
| POST | `/theatres/:id/approve` | — | (audit) E-09 |
| POST | `/theatres/:id/reject` | `reason` | (audit) E-09 |
| GET | `/settings` | — | A-05: the whole `settings` document |
| PATCH | `/settings` | any changeable field | (audit, old + new values). Used by new bookings only. `cities` cannot be changed here (seeded list) |
| GET | `/coupons` | page | A-06 |
| POST | `/coupons` | `code, discountType, value, minAmountPaise?, maxDiscountPaise?, startAt, endAt, totalLimit?, perUserLimit?, cityCodes?, theatreIds?` | `409 ALREADY_EXISTS` for a used code |
| PATCH | `/coupons/:id` | same fields (not `code`) | |
| GET | `/users` | `q?, role?, status?`, page | A-07 (all roles) |
| POST | `/users/:id/block` · `/users/:id/unblock` | `reason?` | (audit) Blocked = cannot log in, logged out at once. Also for owners (A-03) |
| POST | `/admins` | `name, email, password` | (audit) ROLE-06 |
| GET | `/bookings` | `number?, email?, theatreId?, date?`, page | A-08 |
| GET | `/bookings/:id` | — | With payments and refunds |
| POST | `/shows/:id/cancel` | `reason` | (audit) Flow 9.6, the same as the owner cancel |
| GET | `/payouts` | `status?, ownerId?`, page | A-09 |
| PATCH | `/payouts/:id` | `status` (`processing` · `paid`) | (audit) Only forward: pending → processing → paid |
| GET | `/reports/sales` · `/reports/commission` · `/reports/gst` | `from, to` / `month`, `cityCode?, theatreId?, movieId?, format?` | A-10, GST-03 |
| GET | `/banners` | `kind?`, page | A-11 |
| POST | `/banners` | `kind, text, cityCode?, startAt, endAt` | No `cityCode` = all cities |
| PATCH · DELETE | `/banners/:id` | same fields | |
| GET | `/reviews` | `movieId?, hidden?`, page | A-12 |
| POST | `/reviews/:id/hide` | `reason` | (audit) Updates the movie rating |
| POST | `/reviews/:id/show` | — | (audit) |
| GET | `/issues` | `status?`, page | A-13 |
| GET | `/issues/:id` | — | |
| POST | `/issues/:id/replies` | `text` | E-10 to the user |
| PATCH | `/issues/:id` | `status` (`open` · `solved`) | |
| GET | `/audit-logs` | `actorId?, action?, targetType?, from?, to?`, page | A-14, read only |

---

## 11. Uploads (SEC-11, NF-08)

| Method | Path | Who | Body | Result / notes |
| --- | --- | --- | --- | --- |
| POST | `/api/uploads` | Owner · Admin | `multipart/form-data`: `file`, `kind` (`poster` · `cast` · `theatre` · `food`) | `201 { url }`. Only jpg / png / webp, max `uploadMaxMb` (2 MB), file type checked from the content, not only the name. Posters resized to max 800 px wide. Cloudinary; the DB saves only the URL |

---

## 12. Real-time – Socket.io

Same server and port as the API. The client sends the access token in `auth: { token }` when connecting (optional for seat rooms).

| Direction | Event | Data | Notes |
| --- | --- | --- | --- |
| client → server | `show:join` / `show:leave` | `{ showId }` | Room `show:<id>` (9.3) |
| server → client | `seats:update` | `{ showId, seats: [{ seatId, status }] }` | `status`: `held` · `booked` · `available`. Sent after hold, release, confirm, cancel and by JOB-01 for expired holds (U-10) |
| server → client | `show:housefull` | `{ showId, housefull }` | Show list and waitlist button |
| client → server | `dashboard:join` | — | Owner → room `owner:<id>`, Admin → room `admin`. Other roles are refused |
| server → client | `dashboard:update` | `{ theatreId?, ticketsToday, revenueTodayPaise, filledPercent }` | O-02, A-01 (flip numbers UI-37) |

- Background jobs (JOB-01 to JOB-07) have no endpoints. They run inside the server with `node-cron`.

---

## 13. Decisions from the developer review (task 0.9, 2026-09-30)

| Question | Decision |
| --- | --- |
| Owner email verify (O-01) | Yes: owners must verify the email before login, same as users |
| Rate limit numbers | OK as start values; all in one config file `server/src/config/rateLimits.js` |
| Editing a show after bookings | Not allowed, except deal settings. To change, cancel the show (full refund, O-06) |
| Waitlist offer (SF-04) | The freed seat is held only for the offered person for 10 minutes (hold with `expiresAt`) |
