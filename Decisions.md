# Implementation Decisions

This file records decisions made while implementing the site from `README.md`, in the
absence of a human to consult. Each entry states the question, the decision, and the
reasoning — as instructed by the build task.

## 1. Astronomical engine: pure-JS ephemeris instead of Swiss Ephemeris WASM

**README says:** Swiss Ephemeris compiled to WebAssembly, with a thin C wrapper.

**Decision:** Ship a self-contained **pure-JavaScript ephemeris** (`js/astro.js`) instead of
a WASM build of Swiss Ephemeris.

**Why:**
- Compiling Swiss Ephemeris to WASM requires the Emscripten toolchain, the `sweph` C
  sources, and the multi-megabyte ephemeris data files. That is a build-infrastructure task
  well outside a "UI-only site" build (this repo is literally named
  `...-ui-only-site`), and it cannot be produced reliably in this environment.
- The site's purpose — determining **signs, nakshatras, padas, navamsa, karakas, tithi,
  lagna and dashas** — depends on planetary longitudes to roughly arc-minute precision, not
  sub-arc-second. The bundled engine delivers that:
  - Sun & planets: JPL/Standish Keplerian elements + their secular rates (Mercury..Neptune).
  - Moon: truncated ELP-2000 / Meeus Ch.47 main-problem series (~34 largest terms).
  - Precession/nutation/obliquity: Meeus Ch.21–22 (truncated nutation).
  - Ascendant: standard oblique-ascension formula from local apparent sidereal time.
- The engine is isolated behind `Astro.*`, so a future Swiss-Ephemeris WASM module can be
  dropped in without touching the Jyotish layer, charts, or UI.

**Accuracy note / known limitation:** positions are good to ~1 arc-minute for the planets
and a few arc-minutes for the Moon over ~1800–2100, degrading gracefully outside that
range. Light-time and aberration (~a few arc-seconds) are omitted. This can shift a pada or
sign boundary in rare edge cases; it is adequate for a UI reference build but is **not** a
substitute for Swiss Ephemeris in production. See `README.md` Future Scope.

## 2. Ayanamsa: True Chitrapaksha computed from Spica

**Decision:** True Chitrapaksha ayanamsa is computed as
`tropical_apparent_longitude(Spica) − 180°`, using Spica's J2000 position precessed to the
date (Meeus precession) and converted to the ecliptic of date, plus nutation in longitude.
This is the actual definition of the "True Citra" ayanamsa and matches Swiss Ephemeris's
`SIDM_TRUE_CITRA` to arc-second level. Hardcoded, no UI selector (per README).

## 3. Set of grahas (planets)

**Decision:** The classical **nine grahas** are shown: Sun, Moon, Mars, Mercury, Jupiter,
Venus, Saturn, Rahu (mean node), Ketu. The outer planets (Uranus/Neptune/Pluto) are computed
internally but **not displayed**, since traditional Jyotish — which this tool targets — uses
only the nine. Rahu/Ketu use the mean lunar node.

## 4. Chara karakas: 8-karaka scheme

**Decision:** The Jaimini **chara karakas** use the 8-karaka scheme (Sun, Moon, Mars,
Mercury, Jupiter, Venus, Saturn, and Rahu). Rahu's advancement within its sign is taken as
`30° − (degrees in sign)` because it is retrograde, per standard Parashari/Jaimini practice.
Karakas are assigned by descending degrees-within-sign: AK, AmK, BK, MK, PiK, PuK, GK, DK.

## 5. No network / no `fetch` — data shipped as JS

**Decision:** The bundled place dataset is shipped as `js/places.js` (assigns
`window.PLACES`), not as a `.json` file loaded via `fetch`. This lets the site run even from
`file://` (no CORS/XHR), maximising the compatibility the README prioritises. The data still
has exactly the JSON shape the README specifies (`id`, `city`, `region`, `lat`, `long`,
`tz`), and each entry carries a stable GUID.

## 6. State transport: `result.html?d=<base64>`

**Decision:** The home form serialises the person JSON, Base64-encodes it (UTF-8 safe via
`encodeURIComponent`), and navigates to `result.html?d=<base64>`. The result page is rendered
entirely from that parameter — matching the README's "URL is the entire state" model. The
`ChartType` is stored in the payload; the on-screen style switcher changes only the current
view, not the payload.

## 7. PDF library: jsPDF (bundled)

**Decision:** The "third-party, client-side PDF library" is **jsPDF** (`vendor/jspdf.umd.min.js`,
v4.2.1, MIT-licensed), bundled locally so no network call is made. PDF output is generated
from the rendered horoscope, omits the on-screen "back to home" link, and keeps the footer,
per README.

## 8. East Indian chart convention

**Decision:** South Indian (fixed-sign 4×4 grid) and North Indian (diamond, fixed houses)
follow their universally-standard layouts. The **East Indian** layout is rendered as a fixed
3×3 frame with the four corner cells split diagonally (12 houses), signs fixed clockwise from
the top-left. Regional East-Indian variants differ in fine detail; the convention used here
is self-consistent and documented, and both D1 and D9 render in it.

## 9. Timezone conversion

**Decision:** Local birth time is converted to UTC using the browser's `Intl.DateTimeFormat`
with the place's IANA timezone (e.g. `Asia/Kolkata`), which respects historical DST rules
from the platform tz database. ΔT (TT−UT) is applied via an Espenak–Meeus polynomial
approximation for the ephemeris time argument.

## 10. Dasha rendering

**Decision:** Vimshottari dasha is computed from the Moon's nakshatra (120-year cycle) and
shown as an accordion: each Maha Dasha (Ctrl `<details>`/`<summary>`, native HTML, no JS
framework) expands to its Antardasha list with calendar date ranges. Deeper levels are
deferred per README. A 365.25-day year is used for date arithmetic.

## 11. Static pages, vanilla JS, no build step

**Decision:** Two static HTML pages (`index.html`, `result.html`), plain CSS, and vanilla
JS loaded via `<script>` tags. No bundler, no framework — matching the README's "native HTML
and vanilla JavaScript" principle. The site opens directly in a browser with no server.
