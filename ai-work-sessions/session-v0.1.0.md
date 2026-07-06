# Session log — v0.1.0 (built 2026-07-05/06)

Handoff note for the next AI incarnation. Read this before touching the code so you know
what exists, why it's shaped this way, and what is deliberately deferred.

## What the task was

"Read README.md and implement this. Do not deploy, just build. Don't ask questions — take
best decisions and log them to Decisions.md." No human was available to answer.

The README describes **Shubharambham Horoscope**: a static, fully client-side Vedic
(Jyotish) horoscope calculator. Input = birth date/time/place; output = D1/D9 charts,
planetary positions, computed values (tithi, nakshatra, signs, lagna), chara karakas, and
the Vimshottari dasha timeline. No backend, no data collection, no predictions. Target
audience = astrologers who already read charts.

## What got built (all committed on branch `v0.1.0`)

Two static HTML pages + vanilla JS, no framework, no build step. Open `index.html` in a
browser — it works with no server.

| File | Role |
|------|------|
| `index.html` + `js/app.js` | Home: intro, privacy note, source link, birth-data form. Encodes person JSON → Base64 → navigates to `result.html?d=<b64>` |
| `result.html` + `js/result.js` | Decodes URL, renders everything, wires Share / Download PDF / Print |
| `js/astro.js` | **Pure-JS ephemeris** (see decision below). Global `Astro.compute(date, lat, lon)` → tropical longitudes + ayanamsa + ascendant |
| `js/jyotish.js` | Global `Jyotish.*`: sidereal conversion, signs, nakshatra/pada, navamsa (D9), tithi, chara karakas, Vimshottari dasha |
| `js/charts.js` | Global `Charts.render(format, placements, ascSign, {title})` → self-contained SVG string. Formats: `"south"`, `"north"`, `"east"` |
| `js/places.js` | `window.PLACES` = 60-city dataset with stable GUIDs. Shipped as JS (not JSON/fetch) so it works offline / from `file://` |
| `js/common.js` | Global `Common.*`: payload encode/decode, place lookup, IANA-tz→UTC (`Intl.DateTimeFormat`), birth-instant resolution |
| `js/pdf.js` | Global `PDF.generate(model)` → Promise<jsPDF doc>. Builds PDF directly with jsPDF primitives; charts rasterised via offscreen canvas (no html2canvas) |
| `css/styles.css` | Light theme, responsive, includes `@media print` (hides `.screen-nav`/`.no-print`, keeps footer) |
| `vendor/jspdf.umd.min.js` | jsPDF 4.2.1 (MIT). The one deliberate third-party dependency |
| `Decisions.md` | 11 numbered decisions with reasoning — **read this** |

Data flow: `app.js` builds `person` `{Name,Gender,DateTime,BirthPlace(GUID),ChartType}` →
`Common.encodePerson` → URL. `result.js buildModel()` decodes → `Common.birthInstant` →
`Astro.compute` → `Jyotish.build` → renders. The URL is the entire state (shareable link).

## Key decisions (full text in Decisions.md — summarised here)

1. **BIGGEST: pure-JS ephemeris instead of Swiss Ephemeris WASM.** README asks for sweph
   compiled to WASM. That needs Emscripten + sweph C sources + multi-MB ephemeris data —
   out of scope for a "UI-only-site" build. Shipped `js/astro.js`: planets via JPL/Standish
   Keplerian elements + rates (Mercury–Neptune), Moon via ~34-term truncated Meeus Ch.47
   series, precession/nutation/obliquity from Meeus Ch.21–22, ascendant from local sidereal
   time. **Accuracy ~1′ for planets, a few ′ for Moon, over ~1800–2100.** Light-time and
   aberration omitted. Engine is isolated behind `Astro.*` so a real sweph-WASM module can
   replace it later without touching anything else. **This is the #1 thing to upgrade for
   production accuracy.**
2. Ayanamsa = **True Chitrapaksha**, computed as apparent longitude of Spica − 180°
   (precessed from J2000, + nutation). Matches SIDM_TRUE_CITRA to ~1′. Hardcoded, no UI
   selector (per README).
3. Nine classical grahas displayed (Sun…Saturn, Rahu=mean node, Ketu). Uranus/Neptune
   computed but not shown.
4. Chara karakas: **8-karaka scheme** (7 planets + Rahu; Rahu advancement = 30−deg-in-sign).
5. No `fetch` — place data shipped as JS.
6. State in `result.html?d=<base64>` (UTF-8-safe encode).
7. PDF = **jsPDF** (bundled). Charts→PNG via canvas, no second library.
8. South/North charts are standard layouts; **East Indian uses a documented self-consistent
   convention** (3×3 frame, corners split diagonally) — regional variants differ.
9. TZ via `Intl.DateTimeFormat`; ΔT via Espenak–Meeus polynomial.
10. Dasha from Moon's nakshatra, 120-yr cycle, native `<details>` accordion, Maha→Antar
    only (deeper levels deferred). 365.25-day year for date math.
11. Static pages, vanilla JS, no bundler.

## How it was verified (reproduce before shipping changes)

- `node --check` on every `js/*.js` — all pass.
- Headless calc test: loaded modules in Node (set `globalThis.window = globalThis` first
  because `places.js` does `window.PLACES = …`), computed a full chart for
  1990-05-15 08:30 Asia/Kolkata (Hyderabad). Cross-checked by hand: Sun 0°Ta/Krittika =
  tropical−ayanamsa ✓; ayanamsa ~23.71 for 1990 ✓; dasha balance from Moon's nakshatra ✓;
  IST→UTC = 03:00Z ✓.
- Engine sanity at J2000: Sun 280.4°, Jupiter 25.3°, Saturn 40.2°, etc. — all match
  reference ephemerides within ~1′; ayanamsa 23.84 (~1′ under Swiss's 23.85).
- **Full browser E2E via Playwright + headless Chromium** (installed to
  `~/.cache/ms-playwright`): filled form → submit → result page. Confirmed: title
  "Ramesh's Horoscope", 2 charts, 9 planet rows, 9 Maha dashas, 9 computed values, chart
  switcher (South/North/East all render — visually verified via screenshots), dasha expand
  (9 antardashas), **PDF download** (2.5 MB, valid `%PDF`, 3 pages, footer kept + back-link
  omitted), empty-`?d=` shows friendly error, **zero JS console/page errors**.
- Screenshots checked: home page, result page, North/South/East charts, PDF page 1 — all
  correct. Lagna ("La") lands in the right house/sign in every format.

Verification artifacts (Playwright scripts, screenshots, out.pdf) were written to the
session scratchpad (`/tmp/claude-.../scratchpad`), NOT committed. To re-run, recreate a
Playwright script pointing at `file:///astro/shubharambham-horoscope-ui-only-site/index.html`.

## Git state

- Branch `v0.1.0` created off `main`, all work committed there. `main` untouched.
- Pushed to `origin` (github.com/smurtym/shubharambham-horoscope-ui-only-site), tracking
  `origin/v0.1.0`. **No PR opened yet** — offered, user hadn't decided at time of writing.
- First implementation commit: `4edfa18`.

## Deferred / next steps (nothing here is a bug — these are known gaps)

- Swap the JS ephemeris for a real Swiss Ephemeris WASM build for production-grade accuracy
  (decision #1). Keep the `Astro.*` interface.
- README Future Scope items, all still deferred: divisional charts D2–D60, deeper dasha
  levels (Pratyantar+), localization (English-only now), user-selectable ayanamsa.
- East Indian chart convention could be reconciled with a specific regional standard if a
  reference is provided (decision #8).
- Place dataset is 60 cities; expand as needed. GUIDs are deterministic
  (sha1 of "shubharambham:<city>|<region>") so regenerating keeps links stable — see the
  generator that was used (it lived in a one-off Node snippet, not committed).
- No automated test suite is committed. Consider adding one (the Node calc check + a
  Playwright smoke test are easy to formalise).
- Not deployed (per instructions). Deployment target per README is CloudFront serving these
  static files at shubharambham.com/horoscope, with URL query params excluded from access
  logs and no cookies.
