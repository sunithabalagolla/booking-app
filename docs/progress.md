# Progress – Talkies

## Last session

- Date: 2026-10-05 (fourth part)
- **Phase 4 plan** agreed (3 steps, you check each one). Your decisions: `node-cron` is in Section 2 (Background jobs), added in Step 3 with JOB-01; Socket.io packages OK (Step 3); after a hold (Step 2) the seat page shows the timer, the held seats and "Give up seats"; seat class names stay fixed (**UI-22 updated** in requirements).
- **Step 1 done: seat page** (UI-20, UI-21, UI-22, NF-04; part of U-10):
  - Server: new `showseats` model (`models/ShowSeat.js`: unique `{ showId, seatId }` lock, TTL on `expiresAt`, `takenNow()` also checks `expiresAt > now`). `GET /api/shows/:id` (guests: show, movie, theatre, screen, layout, prices with class names) and `GET /api/shows/:id/seats` (users only: taken seats; expired holds count as free). Cancelled / started / unknown show, inactive movie, unapproved theatre → 404. `CLASS_NAMES` moved to `utils/seatLayout.js`. `api.md` updated.
  - Client: `/shows/:id` (users only; guests go to Log in and come back; owners / admins go to their home). Header: back link, title, "Tue 6 Oct · Matinee · 2:30 PM · theatre", screen · language · format. Box office window: wooden frame with arched top, dark window with iron grille, swinging "TICKETS" board on gold strings, cream seat area with "FIRST CLASS · ₹230" headings, row letters both sides, aisles, walkways, curved "SCREEN THIS WAY", ledge with a half-moon slot. Chair seats (`components/ui/Seat.jsx` + `.seat*` CSS): backrest, cushion, armrests; cushion flips down when picked (280 ms bounce); NF-04 marks (✓ ✕ lock, dashed "–" for blocked, ♿); legend. Bottom bar (sticky): "2 seats: E5, E6", "Tickets ₹460", up to 10 seats (BR-02, from settings), Proceed shown but off ("Holding seats comes in the next step"). "A" movies opened straight from a link ask U-08 first ("Go back" = movie page). Housefull show: stamp + "Pick another show" instead of the map. Reduce motion: no cushion flip, no board swing.
  - Checked in Chrome (as the seed test user): age question, picking 2 seats + summary, booked / held look (2 temporary seat records, removed afterwards), 360 px (map scrolls sideways inside the window, starts in the middle; no sideways page scroll), Night show, no console errors. **Your Chrome is now logged in as the test user**, not the owner.
  - Tests: **433 pass** (client 138: seat helpers 7 new; server 295: show + seats 5 new). Lint + build OK.

## Earlier on 2026-10-05 (seed stamps)

- Date: 2026-10-05 (third part)
- U-09 tested in the browser by you: ticked. **Phase 3 done.**
- **Seed: stamp sample shows** (your request): the `shows` step now marks 1 upcoming sample show Housefull (tomorrow 8:00 PM, Chandni Talkies (Sample), Screen 1) and gives 1 a 20% deal (tomorrow 4:30 PM, same screen). Only when no upcoming sample show has it, so running the seed again adds no more. Housefull is only the counter (`bookedCount = totalSeats`), no seats are really booked (see Notes for later). Ran on Docker; both show in the API.
- Fix found while looking at them in Chrome: the Housefull stamp covered part of the time ("8:00 PM"). Both stamps now sit beside the button, never on top.
- Tests: **421 pass** (client 131, server 290: seed stamp shows 1 new). Lint + build OK.

## Earlier on 2026-10-05 (U-09)

- Date: 2026-10-05 (second part)
- U-07 + U-08 tested in the browser by you: ticked.
- **U-09 Show list (UI-17)** with your 3 decisions: SF-08 filter chips on the show list; "Join waitlist" hidden until U-22 (Housefull shows only get the stamp); "from ₹120" on each theatre card.
  - Fills the "Show times" section on `/movies/:id` (no new page). 7 day buttons (Today, Tomorrow, Wed … in IST; scroll sideways on small phones). Filter chips: the movie's languages (only when it has more than one), 2D / 3D, Subtitles, Wheelchair-friendly screen, Parent-and-baby show (one language and one format at a time) + "Clear filters". Day and filters live in the address (`?date=…&format=3D&subtitles=1`; today and empty values left out).
  - Theatre paper cards (A to Z): name, "from ₹120" (lowest price of the day), address, amenities, show times as ticket buttons "Matinee · 2:30 PM" (BR-22) with small tags (language, 3D, Subtitles, Parent & baby). Housefull = grey dashed button with a "Housefull" stamp, not clickable. Deal shows = green "Special offer" stamp. Empty day: "No shows today. The projector is resting." (UI-44); with filters: "No shows match these filters on this day." No city picked: city buttons.
  - A show time opens `/shows/:id` (the U-10 seat page, "not found" until Phase 4). "A" movies ask U-08 first if not answered yet, then open the show.
  - Files: `pages/public/ShowList.jsx`, `showList.js` (+ tests), `api/shows.js` (filters, old list stays while loading), `ticket-shape` in `theme.css`, `MovieDetailsPage.jsx`. Server: no change (API built 2026-10-04); one more test (wheelchair filter, filters combine).
  - Checked in Chrome: Hyderabad list, A-movie age question on a show time → `/shows/:id`, `?format=3D` from the address, 360 px (no sideways page scroll), Night show, no console errors. Not seen on screen: Housefull and Special offer (no sample show has them).
  - Tests: **420 pass** (client 131: show list 7 new; server 289). Lint + build OK.

## Earlier on 2026-10-05 (U-07 + U-08)

- Date: 2026-10-05
- **U-07 Movie details + U-08 Age warning** (started 2026-10-04, stopped by the usage limit; checked and finished today). Requirements UI-16 updated (title in Rye, tagline in Special Elite, light vintage tint, trailer opens a new tab, "A" asks once per movie per browser visit).
  - Server: `GET /api/movies/:id` for guests (`getMovie` in `controllers/movies.js`): list fields + `cast` (`photoUrl` or `null`), `ratingAvg`, `ratingCount`. Inactive / unknown → `404 NOT_FOUND`, bad ID → `400`.
  - Client: `useMovie(id)` (`api/movies.js`); `MovieDetailsPage.jsx` at `/movies/:id`: poster in a film-strip frame, title + certificate stamp (U green, UA mustard, A maroon), tagline, chips (languages, duration, genres, release date for Coming soon), rating, gold "Book tickets", "▶ Watch trailer" (new tab), cast photo cards (silhouette when no photo), "Show times" section (filled by U-09 next), "Reviews" note ("No reviews yet", U-23 later). Missing / inactive movie → "Movie not found" card (UI-36).
  - U-08: `AgeWarningDialog.jsx` (native `<dialog>`, focus stays inside, Escape = Go back, "Go back" has focus first). Only "A" movies ask; "Yes, continue" is remembered per movie in `sessionStorage` (`movie.js`; blocked storage = asks again). Then the page scrolls to Show times.
  - Tests: **413 pass** (client 124: movie helpers 3 new; server 289: movie details 3 new). Lint + build OK. Tested in the browser by you: works.

## Earlier on 2026-10-04 (Home "Stage")

- Date: 2026-10-04
- **Home "Stage" redesign** (`docs/home-design.md`, approved by you). Requirements updated (U-05, UI-15, UI-26, UI-46, A-02, 16.4 note). Your 5 decisions: film grain stays at 3–4% (UI-04 / UI-45); poster titles in Georgia bold (SVG in `<img>` cannot load Rye); "Today in [city]" chips use the U-09 endpoint `GET /api/movies/:id/shows`, built now; the header search box replaces the Home and Search page boxes; content 1120 px, side curtains from 1280 px screens. Built in 3 steps:
  - **Step 1 (data):** optional movie `tagline` (max 120; model, admin API + form field, public list, seed); public list items also have `trailerUrl`. 6 new colourful sample posters (`seed/posters.js`, design Section 9: rain + lightning, haunted house + gulmohar, sunset road + bus, sea + boat, planet + rocket, moon + train). Checked all 6 in Chrome. Tests: 395 pass.
  - **Step 2 (stage frame + header, all public pages):** spotlight glow, velvet pelmet (in front of the curtains) with gold line + scallops, side curtains (thin 12 px velvet edges below 1280 px; from 1280 px gathered curtains with gold rope tie-back + tassel, sway ±0.7° / 7 s), film grain (UI-45, 3.5%, jitter 0.4 s, off with reduce motion), content 1120 px, gold dotted footer line. One-line header: logo, round gold city button, ticket-stub search box ("Search movies, languages, genres…"), Log in + gold Sign up / account links, theme. Below 1024 px: logo + city + ☰ menu (account + theme inside), search box on its own line (**fixes the 2-line phone header**). The header box replaces the Home and Search page boxes: Enter opens `/movies?q=`; on `/movies` it updates the results as you type and keeps the filters. Server: `q` now also matches a movie's languages and genres. Checked in Chrome: 2304 / 1300 / 360 / 320 px (no sideways scroll), header search from Home and on the Search page, Day and Night show. Fixes found: pelmet was behind the curtains; phone header overflowed at 360 px (smaller logo / city button). Tests: 398 pass.
  - **Step 3 (Home content):** ticker under the header (UI-26: coming soon movies + dates, ~30 s loop, pauses on hover / tap / focus). Hero banner: bulbs on all 4 sides chasing round, gold inner line, poster 250 px in a film strip, flickering kicker "✦ NOW SHOWING · MOST SHOWS THIS WEEK ✦", Rye title 62 px (phones 34 px), tagline, info chips (certificate · languages · "2h 36m" · genres), "TODAY / TOMORROW IN [CITY]" ticket chips (from the new U-09 endpoint `GET /api/movies/:id/shows`, same label + time once, max 6, link to the movie), Book tickets, ▶ Watch trailer (only with a trailer link; the sample movies have none), spotlight sweep with dust. Section title rows (gold line, ✦, "See all →"), 4 posters per row on laptops (fills the width), 2 on phones. UI-46 changed: `VintagePoster.jsx` (light tint `sepia(.35) saturate(.85)`, bright layer + 6 px lift on hover / focus, bright when scrolled into view on phones). Coming soon cards 190 px with "Releases Sun 18 Oct" ticket tags. Rise-in for chips and cards. Timings in `motion.js`; everything stops with reduce motion (phone setting). Checked in Chrome: wide screen, hover (bright + lift), 360 / 320 px (fix: the section title row stuck out on phones), all animations running, no console errors. Tests: 406 pass (client 120, server 286).
  - **Curtain fixes** (your request): at most 180 px and 12% of the screen each (73 px at 1280, 153 px at 1440, 180 px from ~1500 px), a smooth curved gather (eased curve, like real fabric) instead of straight lines, darker velvet (pelmet too), gold ropes on both curtains (always above the cloth, reaching a little past the gathered edge). I could not reproduce the missing right rope before the fix (it measured inside the screen at 1366–1920 px); both show now at 1280, 1440, 1920 and 2304 px. If it is still missing on your screen, tell me your screen width.
  - Not checked by hand: the reduce-motion look (needs the phone / OS setting), the phone "bright when scrolled into view" part, the Watch trailer button (no sample trailers).

## Earlier on 2026-10-04 (U-06)

- You asked if the wider layout + side curtains were done: yes, already in commit `49a3d7c` (nothing redone).
- **U-06 Search + filters, SF-08** with your 5 decisions: search box at the top of Home opens the Search page `/movies` (header unchanged); language for Now showing = a show in that language in the city (Coming soon: the movie's languages); several languages / genres = any of them, different filters = AND; Coming soon in the results, hidden while a format / special show filter is on; up to 50 results, no paging.
  - Server: `GET /api/movies` now takes `q` (part of the title, any case, regex-safe), `language` and `genre` (comma separated, fixed lists), `format`, `subtitles`, `wheelchair`, `parentBaby` (`true`). Show filters must all match the **same** show. New shared `utils/escapeRegex.js` (admin movie + owner searches use it too).
  - Client: `SearchPage.jsx` at `/movies` (search box with a 300 ms pause while typing, Language / Genre tick boxes, Format Any / 2D / 3D, Special shows, "Clear search and filters", results as film-strip sepia cards under "Now showing in [city] (n)" and "Coming soon (n)", UI-44 "This reel is not in our cans. Try another name."). Phones: filters fold into "Filters (n)"; laptops: a column on the left. Everything is in the page address (`search.js` helpers), so Back and shared links work. Home has the search box above the banner.
  - Checked in Chrome: Home search "ka" → 2 movies; Tamil → 1, Tamil + Subtitles → none (UI-44 text), Clear → all 6, 3D → Coming soon hidden with a note; 360 px: "Filters (1)" folded, opens on tap, no sideways scroll; a shared link with `?language=Telugu` opens with Telugu ticked. No console errors. My test click opened the city picker by mistake and changed your city to Bengaluru; I set it back to Hyderabad.
  - Docs: `api.md` `/api/movies` updated.
  - Tests: **392 pass** (client 114, server 278). Lint + build OK.

## Earlier on 2026-10-04 (U-05 + wider layout)

- Done: U-04 tested by you (ticked). **U-05 Home page** with your 5 decisions (Now showing = most shows in the city this week first, the first one in the banner; Coming soon = all Coming soon movies in every city; cards + "Book tickets" link to `/movies/:id` = U-07, "not found" until then; empty city text "No shows in [city] this week. The projector is resting."; up to 50 + 20, no paging) and **your extra: the banner movie's poster inside the marquee** (beside the text on wider screens, above it on phones). The theme test content is gone.
  - Server: `GET /api/movies?city=&status=` for guests (`controllers/movies.js`, `routes/movies.js`, `publicMoviesQuery` in `validation/movies.js`). Search + filters come with U-06.
  - Client: `api/movies.js`; Home = marquee banner (`MarqueeBanner.jsx`: maroon box, gold border, blinking bulb rows `MarqueeBulbs.jsx` (UI-14), poster in a film strip, "Now showing", title, certificate + languages, gold "Book tickets" (new `gold` button look)), "Now showing in [city]" grid (2 / 3 / 4 columns, `MovieCard.jsx`: poster in a film strip with sprocket holes top and bottom, title, certificate + languages), "Coming soon" row that scrolls sideways with "From Sun 18 Oct". UI-46 sepia posters (`SepiaPoster.jsx`): colour fades in over sepia (opacity only, 600 ms) on hover / keyboard focus on desktop, by itself when scrolled into view on phones (stays in colour). Timings `bulbCycle` 1200 ms and `sepiaFade` 600 ms in `motion.js`; reduce motion (phone setting) = bulbs still, colour at once. Posters lazy loaded. No new npm package (plain CSS).
  - Checked in Chrome: Hyderabad shows the 4 sample movies, Operation Monsoon in the banner, hover turns a poster to colour, Coming soon row with dates, Day and Night show, 360 px phone (poster above the banner text, 2 columns, no sideways scroll), no console errors. Your own movie "new" is not listed (it has no shows). **Not checked on a real phone:** the "colour when scrolled into view" part (the laptop browser has hover); please look on your phone.
  - Docs: `api.md` `/api/movies` updated.
  - Tests: **380 pass** (client 109, server 271). Lint + build OK.

- Layout fix (your request, after you tested U-05): public pages up to **1280 px** wide (was 1024 px); Now showing grid 2 / 3 / 4 / 5 / 6 posters per row (6 from 1280 px). On **1440 px+** screens: red velvet side curtains (`SideCurtains.jsx`, CSS in `theme.css`, UI-11 velvet colours + gold tie-back), decoration only (no clicks, no animation, hidden on smaller screens). Checked in Chrome at 2304 px: 6 per row, curtains clear of the page, no sideways scroll. Tests: 380 pass.

## Earlier on 2026-10-04 (U-04)

- Done: O-05 tested by you, **Phase 2 done** (separate commit). Then 2 small fixes you asked about (they were not in progress.md before, so they had not been done; separate commit):
  - Show date messages name days like "Sun 4 Oct" (server "cannot be used" message, release day in the client form and the movie picker).
  - No light-blue browser autofill on inputs: autofilled inputs keep cream paper + ink text (`theme.css`). Not checked by hand: Chrome only autofills with saved logins, please look at the login page.
- **U-04 City picker** (Phase 3 start) with your 3 decisions: saved in this browser only (localStorage `talkies-city`); first visit = "Pick your city" card on Home (no pop-up, no location); picker = small list with a tick.
  - Server: `GET /api/cities` (guests too): only cities with an approved theatre, names from settings, A to Z (`controllers/cities.js`, `routes/cities.js`).
  - Client: `store/cityStore.js` (save / load, never crashes in private mode), `api/cities.js` (`useCities`, `useCurrentCity`: a saved city with no approved theatre any more is forgotten), header `CityPicker` next to the logo (public pages only), `CityChooser` card on Home, Home heading "Now showing in [city]" (the movie lists come with U-05). New shared `useDropdown` hook (the theme switch uses it too).
  - Checked in Chrome: first visit card shows the 3 seeded cities only, pick Hyderabad, switch to Chennai in the header (tick moves), reload keeps Chennai, a stale saved city ("mumbai") is forgotten, 360 px phone width fits (no sideways scroll).
  - Docs: `api.md` `/api/cities` updated.
  - Tests: **370 pass** (client 105, server 265). Lint + build OK.

## Earlier on 2026-10-04 (O-05)

- Done: you tested O-07 and later O-05 in the browser (both ticked; **Phase 2 done**); your Phase 10 note on the ledger lines added to "Notes for later". **O-05 Shows + T-08** built with your 5 decisions (3D only on 3D screens; dates today … +30, max 14 per request, start in the future, not before the release day; prices whole ₹1–₹5,000 for every class of the screen; no delete; ~336 sample shows) and **your extra rule: no parent-and-baby tag on "A" movies** (server + form + seed; added to requirements O-05).
  - Server: `models/Show.js` (database.md 5.9, all indexes), `utils/showTime.js` (IST times, BR-22 labels, BR-10 end), `validation/shows.js`, `controllers/ownerShows.js`. Endpoints `GET /api/owner/movies` (new), `GET / POST /api/owner/shows`, `GET / PATCH /api/owner/shows/:id` (`GET /:id` new; PATCH takes one `date`).
  - ROLE-04: shows only on approved theatres (`400 RULE_BROKEN`). Overlap (T-08): `409 SHOW_OVERLAP` lists the refused dates and the shows in the way; several dates = all or none. Two saves at the same moment: `screens.showLock` is changed inside the transaction, so exactly one wins (tested).
  - Edit only before the start and while there are no bookings (`409 IN_USE`). A-02 "movie with shows cannot be deleted" now works (tested).
  - Client: sidebar "Shows". Shows page: theatre / screen / from-date filters, previous / next 7 days, grouped by day, label + time + end, extras, prices, seats sold, Edit (only future shows without bookings). New show form: approved theatres only (others greyed out), screen, movie, language from the movie, format (3D greyed out on a 2D screen), start time, subtitles, parent-and-baby (off for "A"), date boxes for 31 days, a price per seat class of the screen, live preview "Matinee · 2:30 PM – ends 4:45 PM (120 min + 15 min cleaning)", overlap list. Edit form: one date. `SelectField` options can now be disabled.
  - Seed step `shows`: 4 shows per screen per day for 7 days (336), sample movies only, some with subtitles / parent-and-baby (never "A"). Never changes existing shows; a slot that would overlap a hand-made show is skipped.
  - Fix found in the Chrome check: the seed first used **every** Now showing movie, also your own movie "new". Now sample movies only. I deleted the 336 sample shows and seeded again (there were no hand-made shows).
  - Checked in Chrome (owner login): list, new show with an overlap (both clashes listed), new show on 2 dates, edit (movie + parent-and-baby). My 2 test shows were deleted afterwards.
  - Docs: `requirements.md` O-05, `database.md` 5.8 / 5.9, `api.md` Section 8 updated.
  - Tests: **363 pass** (client 102, server 261). Lint + build OK.

## Earlier on 2026-10-04 (O-07)

- Done: you tested O-04 and A-04 in the browser (ticked). **O-07 Canteen items** built with your 5 decisions: real delete allowed; whole rupees ₹1–₹5,000; one name per canteen; also for pending / rejected theatres; sample pictures drawn by code.
  - Server: `models/FoodItem.js` (unique `theatreId + name`), `validation/food.js`, `controllers/ownerFood.js`. Endpoints `GET / POST /api/owner/theatres/:id/food`, `PATCH / DELETE /api/owner/food/:id` (own only, other owner → 404, same name → `409 ALREADY_EXISTS`).
  - Client: theatres table now has "Screens" and "Canteen" links. Canteen page (register table): photo, name, Combo stamp, veg / non-veg mark (`components/ui/VegMark.jsx`: square + dot / triangle + the word), price in ₹, one-click In stock / Out of stock button, Edit, Delete with "Yes, delete / No" in the row (no browser pop-up). Add / edit form: name, price in whole ₹, Veg / Non-veg, In stock, Combo, photo upload. UI-44 empty text "The canteen is closed for now."
  - Seed step `food`: 6 sample items per sample theatre (36): Butter Popcorn, Samosa, Filter Coffee, Cold Drink, Chicken Puff (non-veg), Popcorn + Cold Drink Combo. Vintage SVG pictures in `seed/foodPictures.js`, saved once like uploads.
  - Fix found in the Chrome check: in Night show, **unchecked** checkboxes / radios inside light cards looked dark and filled (like checked). Light paper cards now use the light colour scheme (`theme.css` `.paper`). This also fixes the theatre form amenities.
  - Checked in Chrome (owner login): list, pictures, stock switch, delete confirm (cancelled), price error for ₹49.50, save ₹65. Seed run again afterwards, so the samples are back to normal. One console message "play() request was interrupted" did not come from our code (the app plays no media); probably the browser tool.
  - Docs: `database.md` 5.14 and `api.md` Section 8 updated.
  - Tests: **331 pass** (client 94, server 237). Lint + build OK.

## Earlier on 2026-10-04 (O-04)

- Done: **O-04 Screens + seat layout editor**, with your 4 decisions: screens also for pending / rejected theatres; row letters automatic (A = nearest the screen, rows without seats get no letter, max 26 × 40, numbers left to right, aisles / blocked skipped); wheelchair-friendly automatic; no delete.
  - Server: `models/Screen.js`, `utils/seatLayout.js` (row letters, seat IDs, counts), `validation/screens.js`, `controllers/ownerScreens.js`. Endpoints `GET / POST /api/owner/theatres/:id/screens`, `GET / PATCH /api/owner/screens/:id` (own only, other owner → 404). Same name in one theatre → `409 ALREADY_EXISTS`. Empty cleaning break = settings default (BR-09).
  - Client: theatre list has a "Screens" link → screens table → editor (`SeatLayoutEditor.jsx`): grid size, 6 brushes, ▸ / ▾ paint a whole row / column, marks + colours (B / F / S / ♿ / — , NF-04), row letters on both sides, live seat summary, "SCREEN THIS WAY". Helpers in `validation/screens.js`.
  - Seed step `screens`: 2 screens per sample theatre (12). Screen 1 (2D): Balcony / walkway / First / Second, 2 aisles, 2 wheelchair spaces where the theatre has wheelchair access. Screen 2 (3D): First + Second, 1 aisle.
  - Checked in Chrome (owner login): list, edit Screen 1, painting blocked + wheelchair, save, duplicate name message. Fixed: ♿ showed as a blue emoji, now a plain ink mark. Seed run again afterwards, so the sample screens are back to normal.
  - Docs: `database.md` 5.8 and `api.md` Section 8 updated.
  - Tests: **313 pass** (client 89, server 224). Lint + build OK.

## Earlier on 2026-10-01 (last short session)

- Session start summary + O-04 plan shown (no code changed). Tests then: 281 pass.

## Earlier on 2026-10-01

- Done: **`/api/health` database status** (separate commit), **U-03 forgot / reset password**, the **passwordChangedAt** fix, **O-01 owner register**, **S-01 staff login** + seed test logins, **ROLE-01 to ROLE-06**, the **basic vintage layout**, 3 fixes from your browser check, the card mustard colour, **theme saved in the profile (UI-02)**, **T-01 tests**, the general rate limit (SEC-03) and **helmet + CORS (SEC-08)**.
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
  - Checked by the developer in the browser (2026-10-01): works.
  - Tests: **98 pass** (client 25: `store/authRoutes.test.js` 6 (was `validation/owner.test.js`); server 73: new `auth.staff.test.js` 3, `seed.users.test.js` 2). Lint + build OK. Not checked by hand in the browser yet.
- ROLE-01 to ROLE-06 details (your decisions 2026-10-01):
  - Server: `middleware/role.js` `requireRole(...)` (wrong role → `403 FORBIDDEN`) and `requireApprovedOwner` (ROLE-03, pending / rejected → `403 OWNER_NOT_APPROVED`). Route groups `/api/owner`, `/api/staff`, `/api/admin` with login + role set once (empty until their endpoints come). `middleware/ownership.js` (ROLE-02): `ownedFilter(user)` and `findOwned(Model, id, user)` → `404` when not own. Not used by a real collection yet (theatres come with O-03).
  - ROLE-04: to-do on O-05 (below). ROLE-05 / ROLE-06: tests prove sign up cannot make staff or admin; seed makes the admin.
  - Client: `RoleRoute` page guard + `roleRedirect` / `roleKey` / `PUBLIC` in `authStore.js`. Guest → login; wrong role → quietly to its own home. After login: approved owner → `/owner`, admin → `/admin` (new placeholder "Box office register – comes in Phase 8", ledger paper look, Log out), staff → `/staff/scan`, pending owner → `/owner/pending`, user → where they came from. Staff on public pages (Home) → back to the scanner; owners and admins can browse. Account pages (login, sign up, verify, reset) stay open to all, so email links always work.
  - Checked by the developer in the browser (2026-10-01): all role redirects work.
  - Tests: **131 pass** (client 32: `authRoutes.test.js` 13; server 99: new `roles.test.js` 26). Lint + build OK. Not checked by hand in the browser yet.
- Basic vintage layout details (your decisions 2026-10-01):
  - 3 layouts in `client/src/components/layout/`: `SiteLayout` (public + account pages: header with logo, account area and theme switch; footer with tear line, "For theatre owners" link and © Talkies; "Skip to content" link), `DashboardLayout` (UI-30: ink brown sidebar with logo, role menu, theme switch, Log out; ledger paper main area; top bar on tablet / phone), `StaffLayout` (no header / footer; small wooden bar with logo, theme switch, Log out). Router uses them as layout routes.
  - Header account area: guest → Log in / Sign up; logged in → name, own page link (owner "My register", pending owner "My owner account", admin "Admin register", staff "Gate scanner"), Log out. The old `AuthStatus` line is gone.
  - New UI parts: `ButtonLink`, `Card` (optional `footer` under a tear line), `Stamp` (green / mustard / maroon), `buttonStyles.js` (variants primary / secondary / light). `PaperCard` no longer shows its own logo. New CSS utility `ledger` (Day + Night show). `ThemeSwitch` has `onDark` for dark bars.
  - 404 page now uses the UI-36 text ("This reel is missing from the projector room." + Go to home); the full vintage page stays in Phase 10. Test Home page shows the new buttons, card and stamps.
  - Tests: **138 pass** (client 39: new `navigation.test.js` 7; server 99). Lint + build OK. Not checked by hand in the browser yet.
- Fixes from your browser check (2026-10-01):
  1. Night show: Secondary (outline) button was almost invisible. Now cream on the Night show page (15.0:1), ink inside cards (cards stay light paper).
  2. Night show: green and mustard stamps too dark. New Night show colours (added to requirements UI-01): bottle green `#7FB89F` (8.0:1 on stage dark), mustard `#E8B25C` (9.4:1). Inside cards the day colours stay. Done with CSS variables (`--outline`, `--tone-green`, `--tone-mustard`) + a `paper` class on `Card` (theme.css).
  3. Guest page load showed a red 401 from `/api/auth/refresh`. Now a "was logged in" hint (`talkies_was_logged_in` = `'1'` in localStorage, no token) is set at login and removed at logout / failed refresh; without it the app start makes no refresh call. Note: people logged in before this change get logged out once.
  - Checked by Claude in Chrome on your dev server: Night show colours measured as above; guest reload makes no `/api/auth/refresh` call, no console errors.
  - Tests: **140 pass** (client 41: restoreSession 3 + login hint 1; server 99).
- Mustard on light cards (your decision): `#7D5100` (4.9:1 on light cream) inside cards; `#8A5A00` stays on the page; `#E8B25C` on the Night show page. requirements UI-01 + UI-30 updated.
- Theme saved in the profile (UI-02, your decisions 2026-10-01):
  - Server: `PATCH /api/me/prefs` (`theme?`, `sound?`, `reduceMotion?`, at least one; saves only the sent fields; answers `{ user }`; any role). `prefs.theme` now starts `null` (= not chosen yet) for new accounts; `publicUser` sends `null`.
  - Client: `theme/themeSync.js`. At login (and when a reload restores the login): profile theme `null` → keep the device choice and save it to the profile; profile has a choice → it wins (also saved in localStorage). Changing the theme while logged in saves to the profile; if that fails, the look stays and there is only a console note. `api/me.js` `savePrefs`.
  - requirements UI-02, database.md (`prefs.theme`), api.md updated.
  - **Note:** accounts made before today have `prefs.theme: 'auto'` saved, so for them the profile wins (Auto). To try the "first login keeps the device choice" rule, use a new sign up, or `npm run seed -- --reset` (seed logins then start with `null`).
  - Tests: **153 pass** (client 48: new `themeSync.test.js` 7; server 105: new `me.prefs.test.js` 6). Lint + build OK. Not checked by hand in the browser yet.
- Finish Phase 1 (your decisions 2026-10-01):
  - T-01: new `server/tests/t01.test.js` (7): each of the 4 roles logs in → `/api/me` → own API group passes, the others 403; pending owner refused everywhere; owner set to rejected after login is stopped on the next call; blocked admin stopped at once; 3 refreshes at the same moment with the same cookie → exactly one wins. Together with `auth.session.test.js`, `roles.test.js`, `auth.staff.test.js`. **Ownership on real endpoints is added with O-03.**
  - SEC-03: general limit 300 per 15 min per IP on all `/api` calls except `/api/health` (`generalLimiter` in `rateLimits.js`).
  - SEC-08 (your request, earlier than planned): `helmet` 8.3.0 and `cors` 2.8.6 (both in Section 2). CORS allow-list from `CLIENT_URL` (one URL or several with commas), cookies allowed; other sites get no CORS headers (no 500). `server/src/config/security.js`. HTTPS in production stays for Phase 12.
  - New `server/tests/security.test.js` (6): helmet headers, CORS allow / pre-check / refuse, general limit + health not limited.
  - Checked on your running dev server: `/api/health` 200 with the new headers, also through the Vite proxy.
  - U-03 and O-01: checked by the developer in the browser, both work.
  - Tests: **166 pass** (client 48; server 118).
  - Theme in profile + final role pass (all 4 seed logins): checked by the developer in the browser, both work. **Phase 1 done.**
- **A-04 Theatre approvals** (your decisions 2026-10-01):
  - `GET /api/admin/theatres` (status tabs, city filter; pending oldest first; with owner details), `POST /api/admin/theatres/:id/approve` (from pending or rejected; not while the owner is blocked → `owner_blocked`) and `/reject` (reason 5–500, only from pending). Atomic + audit (`theatre.approve` / `theatre.reject`) in one transaction; two admins at once → one wins. E-09 to the owner (`theatreDecisionTemplate`, with a link to the theatre).
  - Client: admin sidebar "Theatres" with a gold count of waiting theatres; `/admin/theatres` register table (theatre with address, "Open map", photo thumbnails, amenities; city + state + GSTIN; owner details; sent date; status stamp; Approve / Reject with reason box; "Owner blocked" stamp and no Approve).
  - requirements A-04, api.md updated.
  - Tests: **281 pass** (client 78: theatre buttons 3; server 203: admin theatres 11). Lint + build OK. Not checked by hand in the browser yet.
- **O-03 Theatres** (your decisions 2026-10-01):
  - `Theatre` model (database.md 5.7). Owner endpoints (approved owners, own only): `GET /api/owner/cities` (new, for the form; api.md updated), `GET / POST /api/owner/theatres`, `GET / PATCH /api/owner/theatres/:id`. No delete.
  - Rules: new = Pending (ROLE-04); city from settings; GSTIN must start with the city's GST state code (`server/src/config/gstStates.js` + client copy, a test checks they match); max 6 photos; map link https. After approval city + GSTIN locked (`400 RULE_BROKEN`, `locked_after_approval`); editing a rejected theatre → Pending again. requirements O-03, database.md, api.md updated.
  - T-01 ownership on real endpoints: another owner's theatre → 404 for GET and PATCH; own list only.
  - Client: owner sidebar "Theatres"; `/owner/theatres` register table (city, address, amenities, status stamp + reject reason; empty text "No theatres yet…"); `/owner/theatres/new` and `/:id` form (city drop-down with state, GSTIN hint + state check, locked fields after approval, amenities, up to 6 photos with Remove).
  - Seed step `theatres`: 6 approved sample theatres for `owner@talkies.test` (2 each in Hyderabad, Chennai, Bengaluru; made-up GSTINs with the right state code). `staff@talkies.test` linked to the 2 Hyderabad theatres (the "no theatres yet" gap is closed; a reseed keeps the link). Ran on Docker.
  - Tests: **267 pass** (client 75: GST codes 2, theatre form 5; server 192: owner theatres 14, seed theatres 3). Lint + build OK. Checked by the developer in the browser (2026-10-01): works.
- **A-03 Owner approvals** (your decisions 2026-10-01):
  - `GET /api/admin/owners` (tabs by status, search start of name / email / business, pending oldest first), `POST /api/admin/owners/:id/approve` (from pending or rejected, email must be verified) and `/reject` (reason 5–500, only from pending). Atomic + audit entry in one transaction; two admins at once → one wins. E-09 email (`ownerDecisionTemplate`, vintage style) after the decision.
  - Owner block / unblock now (your decision): `POST /api/admin/users/:id/block` · `/unblock` (owners only until A-07), audit `user.block` / `user.unblock` with the optional reason. Blocking deletes the refresh tokens of the owner and their Gate Staff.
  - ROLE-05 rule: `utils/accountBlock.js` `blockedReason()` used at login, refresh and in `requireAuth`: a blocked owner's Gate Staff get `403 ACCOUNT_BLOCKED` ("Your theatre owner's account is blocked…").
  - Client: sidebar "Owners" with a gold count of waiting owners; `/admin/owners` register table (Pending / Approved / Rejected / All, search; Approve, Reject with reason box, Block with optional reason, Unblock; "Email not verified" stamp, no Approve until verified). Owner waiting page loads the account again on open + "Check again" button, so an approved owner goes straight to `/owner`.
  - requirements A-03 + ROLE-05, api.md updated.
  - Tests: **243 pass** (client 68: owner buttons 4; server 175: admin owners 14). Lint + build OK. Checked by the developer in the browser (2026-10-01): works.
- **A-05 Platform settings** (your decisions 2026-10-01):
  - `Settings` model (one document `'platform'`, defaults from database.md 5.4; made with defaults if missing). `getSettings()`.
  - `AuditLog` model + `writeAudit()` (A-14, SEC-13; insert only). `targetId` is an ObjectId or text (`'platform'`).
  - `GET / PATCH /api/admin/settings`: only changed fields are saved, one audit entry with old + new values, in one transaction. Agreed ranges; `cities` cannot be changed (400). `GET /api/settings/public`: the 6 values from api.md + `uploadMaxMb` (for the browser upload check; api.md updated).
  - Now read from settings: access / refresh token life (login + refresh), reset link minutes, upload max MB (multer limit per request), poster max width (Cloudinary). `config/auth.js` / `config/uploads.js` constants removed.
  - BR-17 stays in `rateLimits.js`: `loginMaxAttempts` / `loginWindowMinutes` removed from database.md.
  - Seed step `settings` (runs first): 10 cities with GST state; TEST values only where empty (commission 10 %, GST 18 / 5 / 18 %, `TEST-*` HSN codes, "Talkies Sample Pvt Ltd (TEST)"). Ran on Docker.
  - Client: sidebar "Settings", `/admin/settings` with 8 groups (fee in rupees, saved as paise; hint with unit + rule ID; "Not set yet: needed before bookings open"); TEST warning; read-only city list; sends only changed fields. Image upload check now uses the `uploadMaxMb` setting.
  - Tests: **225 pass** (client 64: settings form 6; server 161: settings 14). Lint + build OK. Checked by the developer in the browser (2026-10-01): works.
- **Phase 2 started: A-02 Movies** (your decisions 2026-10-01):
  - New packages (Section 2): `multer` 2.4.0, `cloudinary` 2.11.0.
  - Uploads `POST /api/uploads` (approved owner / admin; `kind` poster · cast · theatre · food; jpg / png / webp checked from the first bytes; max 2 MB). Cloudinary when the 3 keys are in `.env` (posters max 800 px wide); **no keys in development → saved in `server/uploads/`** (git-ignored, no resize), served at `/api/uploads/files/<name>`. Production without keys → server refuses to start. `services/upload/index.js`, `config/uploads.js`.
  - Movies: `Movie` model (database.md 5.6), `GET / POST /api/admin/movies`, `GET / PATCH / DELETE /api/admin/movies/:id`. Delete only without shows / bookings (`409 IN_USE`, checked in those collections). Release date = IST day, stored as 00:00 IST in UTC (`utils/time.js`).
  - Fixed lists in `server/src/config/movieOptions.js` (+ client copy, a test checks they match): 10 languages, 14 genres incl. Sci-Fi and Mystery. requirements A-02 + U-06 updated.
  - Client: sidebar "Movies", `/admin/movies` register table (poster, title, cert., languages, release, status stamp; search, status filter, pages), `/admin/movies/new` and `/admin/movies/:id` form (poster upload with preview, languages / genres checkboxes, cast with optional photos, delete with "Yes, delete" step; "make it inactive" text when in use). New UI parts: `SelectField`, `CheckboxGroup`, `ImageUpload`. Error text now follows the surface (`--tone-alert`: maroon on light, gold on the Night show page).
  - Seed step `movies`: 6 made-up sample movies (4 now showing incl. one "A", 2 coming soon) with vintage SVG posters drawn by code (`seed/posters.js`). Ran on Docker; looked at all 6 posters in Chrome (fixed the title overlapping the circle).
  - Fix found by a new test: 4xx errors from Express helpers (e.g. a missing upload file) were answered as 500; now 404 / 400 with our own message.
  - Tests: **205 pass** (client 58: movie lists 5, movie form 5; server 147: admin movies 13, uploads 10, seed movies 3, IST time 4). Lint + build OK. Checked by the developer in the browser (2026-10-01): works.
- Earlier (2026-09-30): Phase 0, U-01, U-02.

## Next step

- Try the new Home "Stage" design by hand: Home, header search, ☰ menu on your phone, Day / Night show, reduce motion on your phone (all animations should stop), a movie with a trailer link (add one in admin Movies).
- Check **Phase 4 Step 1** (seat page) in the browser: a show time → seats, pick / unpick, the 10-seat limit, an "A" movie, your phone, Night show.
- Then **Step 2: U-12 hold + timer** (`bookings` model, `POST /api/bookings/hold` in one transaction, timer after refresh, Interval card UI-33, "Give up seats", T-02, T-03).
- Then **Step 3: U-10 live** (Socket.io rooms, `seats:update`) + JOB-01 with `node-cron`.
- Check the login page autofill colour (fix from 2026-10-04, not checked by hand yet).
- Later (your choice when): Postmark account, then `POSTMARK_API_KEY` and `EMAIL_FROM` in `.env`.

## Known bugs

- One 502 on `/api/auth/login` during your browser test (2026-10-01). 502 comes from the Vite dev proxy when the Express server on port 5000 cannot be reached. The Express server process restarted at 14:33:44 (the `--watch` parent started 12:40:50); no project file changed at that time, so the cause is not known yet. Look at the server terminal near the 502: `Restarting 'src/server.js'` = watch restart; an error stack = crash. Vite also logs `http proxy error: /api/auth/login` with ECONNREFUSED (server down / restarting) or ECONNRESET (crashed during the request).

## Notes for later

- **Sample Housefull show (seed, 2026-10-05):** only `bookedCount` is set to `totalSeats`; no seats are booked. When U-10 / U-12 / bookings come, decide: book its seats in the seed too, or leave it (it cannot be clicked, so nobody reaches its seat map).


- **Phase 10 (UI polish), decide later** (your note 2026-10-04): the UI-30 ledger lines look like a modern grid in Night show and run behind tables. Options: fainter lines, no lines behind tables, maybe no lines at all in Night show.

- Client build warns that the main JS file is over 500 kB (571 kB after the Stage Home, 509 kB before O-04). Not a bug. Later (NF-09, Phase 10/12): split owner / admin pages with `lazy()` so users do not download them.

- `/api/health` shows database status: decided **yes** in task 0.6 (written down 2026-10-01). Built 2026-10-01: `200 { status: 'ok', db: 'connected' }`, `503 { status: 'error', db: 'disconnected' }`.

- Local uploads (development) are not resized; Cloudinary resizes posters. Local files are not deleted when a movie is deleted or a poster changes (Cloudinary clean-up: decide later).
- Rate limit counts are kept in server memory (`express-rate-limit` MemoryStore): they reset when the server restarts, and do not work across several server copies. OK for now; look again at deploy time (Phase 12).

- Owner blocked → their Gate Staff cannot log in (ROLE-05, A-07). Check it at login, refresh and in `requireAuth`. Build with A-07 (Phase 8).

- Component tests (React parts on screen) need `@testing-library/react` + `jsdom` (not in Section 2). For now only helper functions are tested. **Decide in Phase 4** (seat map) (your decision 2026-10-01).

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
- [x] Move `ThemeSwitch` from the test Home page into the real header (basic vintage layout, 2026-10-01; also in the dashboard sidebar and staff bar)
- [x] Save the choice in the user profile when logged in; profile choice wins over localStorage, empty profile keeps the device choice (2026-10-01)
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

## Phase 1 – Auth and roles ✅ done
- [x] U-01 Sign up + verify email (with resend, max 3 per hour)
- [x] U-02 Login / logout + tokens
- [x] U-03 Forgot password (reset link 30 min, all devices logged out, also verifies the email; tested in the browser by the developer 2026-10-01)
- [x] O-01 Owner register (Pending, phone rule, waiting for approval page; tested in the browser by the developer 2026-10-01)
- [x] S-01 Staff login (opens to `/staff/scan` placeholder; seed test logins for all 4 roles; tested in the browser by the developer 2026-10-01)
- [x] ROLE-01 to ROLE-06 role + ownership middleware (ROLE-04 built with O-05 on 2026-10-04; tested in the browser by the developer 2026-10-01)
- [x] Basic vintage layout: header, footer, buttons, cards (SiteLayout, DashboardLayout, StaffLayout)
  - [x] Footer link "For theatre owners" → `/owner/signup` (O-01, your request 2026-10-01)
  - [ ] Bottom navigation (UI-15: Home, Ticket album, Profile): add when Ticket album (U-18, Phase 6) and Profile (U-25) exist (your decision 2026-10-01)
- [x] UI-02 theme choice saved in the profile when logged in (`PATCH /api/me/prefs`, empty profile keeps the device choice)
- [x] T-01 tests (login, refresh incl. race, role checks, DB decides not the token). Ownership on real endpoints: added with O-03
- [x] SEC-03 general limit 300 / 15 min per IP (not `/api/health`)
- [x] SEC-08 helmet + CORS allow-list from `CLIENT_URL` (HTTPS in production: Phase 12)
- [x] Phase 1 check by hand: theme in profile + final role pass for all 4 seed logins (developer, 2026-10-01: both work)

**Phase 1 done (2026-10-01).** All 4 roles log in and see only their pages.

## Phase 2 – Admin + owner setup ✅ done (flow 9.1 works end to end; tested by the developer 2026-10-04)
Order (your decision 2026-10-01): A-02 → A-05 (city list needed by O-03) → A-03 → O-03 → A-04 (needs theatres) → O-04 → O-07 → O-05 + T-08.
- [x] A-02 Movies (admin list / add / edit / delete, uploads, fixed lists, 6 sample movies; tested in the browser by the developer 2026-10-01)
- [x] A-05 Platform settings (admin page, audit log, public values, 10 cities, TEST values in the seed; tested in the browser by the developer 2026-10-01)
  - [x] Moved token lifetimes, reset link minutes, `uploadMaxMb` / `posterMaxWidthPx` into settings
- [x] A-03 Owner approvals (list, approve / reject + E-09, block / unblock owners + their staff, audit; tested in the browser by the developer 2026-10-01)
- [x] O-03 Theatres (list / add / edit, GSTIN state check, locked city + GSTIN after approval, 6 sample theatres; tested in the browser by the developer 2026-10-01)
  - [x] T-01: ownership tests on the real theatre endpoints (other owner's theatre → 404). Staff "only their theatres" is tested with the scanner (S-03, T-07)
- [x] A-04 Theatre approvals (list + city filter, approve / reject + E-09, no approve while the owner is blocked, audit; tested in the browser by the developer 2026-10-04)
- [x] O-04 Screens + seat layout editor (list / add / edit, automatic row letters + wheelchair-friendly, 12 sample screens; tested in the browser by the developer 2026-10-04)
- [x] O-07 Canteen items (list / add / edit / delete, stock switch, veg mark, whole rupees, 36 sample items with pictures; tested in the browser by the developer 2026-10-04)
- [x] O-05 Shows (labels BR-22, end time BR-10, overlap check, no parent-and-baby on "A"; 336 sample shows; tested in the browser by the developer 2026-10-04)
  - [x] ROLE-04: a show can be live only when its theatre is approved (pending / rejected theatre → refuse, tested)
- [x] T-08 test (overlap cases, touching edges, cleaning break, all-or-none dates, two saves at the same moment)

## Phase 3 – User browsing ✅ done (guests browse real shows by city; tested by the developer 2026-10-05)
- [x] U-04 City (header picker + first visit card, saved in the browser, only cities with approved theatres; tested in the browser by the developer 2026-10-04)
- [x] U-05 Home (marquee banner with poster + bulbs, film-strip posters, Now showing grid, Coming soon row, UI-46 sepia; tested in the browser by the developer 2026-10-04)
- [x] U-06 Search + filters, SF-08 (Search page `/movies`, filters in the address, same-show rule; checked in Chrome 2026-10-04)
- [x] U-07 Movie details (`/movies/:id`, `GET /api/movies/:id`; done 2026-10-05, tested in the browser by the developer 2026-10-05)
- [x] U-08 Age warning (in-page dialog for "A" movies, once per movie per browser visit; done + tested in the browser by the developer 2026-10-05)
- [x] U-09 Show list ("Show times" on `/movies/:id`: 7 days, SF-08 filter chips, theatre cards with "from ₹…", BR-22 labels, Housefull stamp; done 2026-10-05, checked in Chrome; tested in the browser by the developer 2026-10-05)

## Phase 4 – Seats
- [x] UI-20 Box office window (Step 1, 2026-10-05; waiting for your check)
- [x] UI-21 Chair seat + UI-22 class names (fixed names; Step 1, 2026-10-05; waiting for your check)
- [ ] U-10 Live seat map (Socket.io) (seat page + taken seats done in Step 1; live updates = Step 3)
- [ ] U-12 Seat hold + timer
- [ ] JOB-01
- [x] NF-04 colour-blind marks (seat marks + legend; Step 1, 2026-10-05)
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
- [ ] A-07 Users (block / unblock for owners + the staff rule are done in A-03; extend `/users/:id/block` to the other roles)
- [ ] A-08 All bookings
- [ ] A-14 Audit log

## Phase 9 – Special features
- [ ] SF-01 Show timing insights
- [ ] SF-02 Ticket transfer
- [ ] SF-03 Smart seat pick
- [ ] SF-04 Waitlist (U-22), JOB-03. **Note (2026-10-05):** the U-09 show list hides "Join waitlist" for now; Housefull shows only get the stamp. Add the "Join waitlist" link to Housefull show times in `ShowList.jsx` here (UI-17).
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
- [x] UI-46 Sepia posters (built early with U-05 on 2026-10-04; profile "reduce motion" setting comes with UI-41)
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
