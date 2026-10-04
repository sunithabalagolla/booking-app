# Home page design (approved) – "Stage" version

Replaces the current Home look (U-05). Same data and API as now; only the look changes.
All colours from UI-01. Fonts: Rye (headings), Special Elite (labels), Courier Prime (body).
Works in Day show and Night show; this spec describes Night show (stage dark). In Day show use the same layout on paper cream with ink text.

## 1. Stage frame (whole page, wide screens)

- **Background:** stage dark #1E140E with a soft warm spotlight glow at the top centre (very light radial glow, gold at about 13% opacity).
- **Top pelmet (valance), full width:** a 34 px tall velvet band (maroon folds, see "Velvet" below) with a 3 px gold (#D9A441) line under it, and a row of small half-circle scallops under that (dark maroon #5E1515, gold border).
- **Side curtains** (changed 2026-10-04: at most 180 px and 12% of the screen each, smooth curved gather, darker velvet, a rope on both curtains): about 130 px wide at 1440 px screens, only on screens 1280 px and wider (hidden on smaller screens). Velvet folds, shaped like a curtain that is gathered: straight at the top, pulled in towards the edge at about 55% height, and flaring out again at the bottom (CSS clip-path).
- **Gold rope tie-backs:** a short gold bar with a small tassel at the gather point on each curtain.
- **Velvet:** vertical folds made with a repeating linear gradient: #4E1010 → #8E2626 → #6A1818 → #A0302E → #4E1010, about 32 px per fold.
- **No hard borders** around the content area (remove the old gold side lines).
- **Content width:** about 1120 px, centred, between the curtains.
- **Phones:** pelmet 22 px with smaller scallops, and only a thin 12 px velvet edge on the left and right.

## 2. Header (one line)

Left to right: "Talkies" logo (Rye, gold, ~36 px) · city button ("📍" drawn as an SVG pin + "Hyderabad ▾", gold outline, round) · **search box in the centre** (≈420 px, cream #F3E9D2 background, **dashed** dark-mustard #8A5A00 border like a ticket stub, magnifier icon, text "Search movies, languages, genres…") · "Log in" link · "Sign up" gold button · theme moon/sun button.

**Phones:** logo + city + a **menu button (☰)** on one line; Log in / Sign up / theme go inside that menu (fixes the 2-line header note). The search box goes on its own line under the header.

## 3. Ticker strip (UI-26)

Under the header: a thin dark strip (#120C08) with gold lines above and below, cream typewriter text scrolling right to left: coming soon movies with dates, deals, and admin ticker messages (A-11 later; for now coming soon movies only). Pauses on hover. Reduce motion: no scrolling, show the first message.

## 4. Hero banner (marquee)

- **Box:** maroon #7B1E1E, 3 px gold border, rounded 14 px. **Gold bulbs on all 4 sides** (top and bottom rows + left and right columns), blinking one after another (1.2 s loop).
- **Inside**, a thin gold inner line, then 2 columns (phones: 1 column, centred):
  - **Poster** (≈250 × 375 px) in a film-strip frame (sprocket strips top and bottom).
  - **Text column:**
    - Kicker: "✦ NOW SHOWING · MOST SHOWS THIS WEEK ✦" (Special Elite, letter-spaced, light gold #F2C766).
    - Title: Rye, ~62 px (phones ~34 px), cream.
    - Tagline: Special Elite ~20 px. (Needs a short `tagline` on movies: add an optional field, max 120 characters, to A-02 and the seed.)
    - Info chips (outlined): certificate · languages · duration ("2h 36m") · genres.
    - **"TODAY IN [CITY]"** + small cream ticket chips for today's shows of this movie in the city, each with the show label (Morning show / Matinee / …) and time. If none are left today, show "Tomorrow" chips instead.
    - Buttons: gold **Book tickets** (to /movies/:id) and an outlined **▶ Watch trailer** (opens the trailer link in a new tab; hide if no trailer).
- **Spotlight sweep:** a soft light patch moves slowly left → right across the banner (9 s, back and forth), with a few dust specks floating up in it.

## 5. "Now showing in [City]"

- Title row: Rye ~32 px gold + a thin gold line that fills the row + "✦" + "See all →" (to /movies).
- Grid: 4 columns on laptops (5–6 if wider), 2 on phones. Cards fill the full width (no empty space on the right).
- **Card:** poster in film-strip frame, title (Special Elite ~18 px), certificate + languages (small).
- **Posters (change to UI-46):** posters show in colour with a **light** warm vintage tint (CSS `filter: sepia(.35) saturate(.85)`), and become fully bright on hover/focus (0.6 s), with a small lift. On phones they become bright when scrolled into view. Reduce motion: no lift, instant change.

## 6. "Coming soon"

Same title style (no "See all"). A sideways-scrolling row of smaller cards (≈190 px). Under each: a small cream ticket tag "Releases Thu 15 Oct".

## 7. Footer

Dotted gold line, "For theatre owners" link, "© Talkies".

## 8. Animations (all must stop with reduce motion, UI-41)

| What | How |
| --- | --- |
| Curtains sway | Each curtain rotates ±0.7° from its top corner, 7 s, back and forth |
| Bulbs | Blink one after another, 1.2 s |
| Spotlight + dust | See hero banner |
| Film grain | Very light noise over the whole page (opacity ~0.07), jitters every 0.4 s; never makes text harder to read |
| "NOW SHOWING" flicker | Short opacity dips like an old neon sign, every ~5 s |
| Rise in | Show chips and poster cards fade up one by one on page load (0.7 s, 0.12 s apart) |
| Poster hover | Lift + full colour (see 5) |
| Ticker | Scrolls right to left, ~30 s per loop |

Only `transform` and `opacity` for movement. Timings in `motion.js`.

## 9. Sample posters (seed)

Make each sample poster **different and colourful** (not the same sun design for all). Drawn by code as SVG, each with its own palette and picture:

| Movie | Picture | Colours |
| --- | --- | --- |
| Operation Monsoon | Rain lines, a lightning bolt, a dark figure | Navy #16324A, gold lightning |
| Ghost of Gulmohar Lane | Moon, a dark house with one lit window, a red gulmohar tree | Dark green #13201A, red #C8402E |
| Sapnon Ka Safar | Sunset bands, a road going to the horizon, a small bus | Orange / coral / plum |
| Kadal Kaatru | Sun, sea waves, a sailing boat, birds | Sand #F1D9A8, sea #2F6F86 |
| Star Voyage 1983 | Stars, a ringed planet, a rocket | Purple #24163A, rust planet |
| Chandamama Express | Big moon, a small train on a track | Night blue #1B2B4A |

Title text on each poster in Rye, two lines, in the poster's own colours.

## 10. Requirements to update

- U-05 / UI-15: this layout.
- UI-46: light vintage tint instead of full sepia.
- UI-26: ticker now on Home (coming soon messages first).
- A-02: optional `tagline` field.
- Header on phones: menu button (closes the 2-line header note).
