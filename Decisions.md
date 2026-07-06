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

---

# v0.2.0 decisions (Swiss Ephemeris integration)

Assignment `work-assignment/v0.2.0.txt`: "use swiss ephemeris now. emcc is already installed
… git clone official swiss ephemeris and plug into the site." No human available; decisions
taken autonomously.

## 12. Swiss Ephemeris WASM now replaces the pure-JS engine (supersedes #1)

**Decision:** The pure-JavaScript ephemeris from v0.1.0 is retired. `js/astro.js` is now a
thin wrapper over the **official Swiss Ephemeris 2.10.03** compiled to WebAssembly with
`emcc` (Emscripten 4.0.13). Source cloned from `github.com/aloistr/swisseph`; artifact and
build script live in `vendor/sweph/`. Decision #1 (which deferred this) is **superseded** —
the toolchain the earlier build lacked (emcc) is now present, as the assignment noted.

**Why:** the README always wanted real Swiss Ephemeris; #1 only deferred it for lack of the
toolchain. sweph is the authoritative sub-arcsecond reference and removes the truncation
error of the JS series (which reached ~3–4′ for Jupiter/Saturn — see verification below).

## 13. Moshier mode (`SEFLG_MOSEPH`), no `.se1` data files

**Decision:** Compute in Swiss Ephemeris's **Moshier** mode, which uses built-in analytical
theory and needs **no multi-megabyte ephemeris data files**.

**Why:** the site is a static, offline, `file://` app with no server and no fetch. Shipping
(or fetching) the `sepl_*.se1`/`semo_*.se1` files would break that constraint. Moshier is
sub-arcsecond for the planets over several millennia and keeps the Moon within ~0.1′ — far
better than the v0.1.0 JS engine and ample for signs/nakshatras/padas. The small accuracy
gap vs. the full JPL-data ephemeris is an accepted trade for zero data files.

## 14. `SINGLE_FILE=1` — WASM inlined into the JS

**Decision:** Build with Emscripten `SINGLE_FILE=1`, embedding the `.wasm` as base64 inside
`vendor/sweph/sweph.js` (one ~565 KB file) rather than shipping a separate `sweph.wasm`.

**Why:** browsers block `fetch()`/`instantiateStreaming` of a sibling `.wasm` under the
`file://` scheme, and the whole project is designed to run from `file://`. Inlining removes
the fetch entirely, so the engine loads from a plain `<script>` with no network or file I/O.
Verified working from `file://` via headless Chromium.

## 15. Async load, synchronous compute; interface preserved

**Decision:** WASM instantiation is asynchronous, so `Astro` gains one new method,
`Astro.ready()` → Promise, which `result.js`'s `main()` awaits once before building the
model. `Astro.compute(date, lat, lon)` stays **synchronous** and returns the exact same shape
as v0.1.0 (`{jdUT, obliquity, ayanamsa, planetsTropical:{Name:{lon,lat}}, ascendantTropical}`),
so the Jyotish layer, charts, dasha and PDF were untouched.

The shim (`vendor/sweph/se_shim.c`) exposes a single `se_compute()` that fills a flat array
of 13 doubles, so the JS glue makes one call per chart instead of juggling several sweph
calls and their buffers. Ayanamsa stays **True Chitrapaksha** (`SE_SIDM_TRUE_CITRA`) and
Rahu stays the **mean** node (`SE_MEAN_NODE`) — both matching v0.1.0 decisions #2 and #3.
Planetary latitude is not consumed downstream (signs/nakshatras use longitude only), so the
shim omits it and the wrapper reports `lat: 0` to preserve the `{lon,lat}` shape.

**Verification:** rebuilt-in-Node cross-check + Playwright E2E from `file://`. At J2000 the
engine gives Sun 280.37°, Jupiter 25.25°, Saturn 40.40°, ayanamsa 23.836° — all matching
reference ephemerides. For 1990-05-15 08:30 IST Hyderabad the rendered chart shows Sun
0°19′ Taurus / Krittika pada 2 and ayanamsa 23.7151, matching v0.1.0's hand-checked values;
sweph vs. the old JS engine agreed to a few arcminutes (worst: Saturn ~4′, Jupiter ~3′).
Charts (South/North), the dasha accordion and the 3-page PDF all render with zero console
errors.

---

# v0.4.0 decisions (portal bug-fix batch)

Assignment `work-assignment/v0.4.0.txt`: 13 numbered fixes to the portal. No human available;
decisions taken autonomously and recorded here.

## 16. East Indian chart is now the authentic anti-clockwise layout (supersedes #8)

**Question:** v0.1.0 #8 admitted the East Indian chart used a "self-consistent" *clockwise*
guess rather than a real regional standard (item 1 flagged it looked wrong).

**Decision:** Render the authentic East Indian (Bengali/Odia/Maithili) layout: the 12 rasis
are **fixed** to their cells (like the South Indian chart), **Aries (Meṣa) occupies the
top-centre cell**, and the remaining signs run **anti-clockwise** from it. This replaces the
earlier clockwise arrangement. `js/charts.js` `EAST_CELLS` was recomputed accordingly (top
edge reads 2·1·12 left-to-right; numbers increase anti-clockwise around the ring).

**Source:** Wikipedia, *Kundali (astrology)* — "The first rāśi, Meṣa occupies the central
cell in the top row … the other rāśis … in the anti-clockwise direction." Corroborated by
astrojyoti/astrosage descriptions ("fixed signs like South, charted anti-clockwise").

## 17. Vimshottari measured by the Sun's real sidereal revolution (item 8)

**Decision:** Dasha period boundaries are no longer placed by adding fixed-length calendar
years. A Vimshottari "year" is one full **360° revolution of the Sun in sidereal longitude**
(a sidereal / nakshatra year). For a boundary at dasha-age *A* (years since the first Maha
Dasha began), the calendar instant is found by solving, with **Newton–Raphson**, for the time
at which the Sun's sidereal longitude has advanced *(A − elapsed)·360°* from its birth value.
`Jyotish.vimshottari` takes an injected `sunLonAt(date)` (wired in `result.js` to
`Astro.compute`); the mean sidereal-year length (365.256363 d) is used only as the Newton
seed and as an offline fallback.

**Why sidereal (not tropical):** the app is sidereal/Vedic, and "the degrees the Earth
revolved around the Sun" reads most naturally in the fixed-star frame (the nakshatra year).
The choice mainly affects the mean year length by ~0.004%; the dominant, visible effect —
captured either way — is the Earth's orbital eccentricity, which shifts antardasha
boundaries landing in other seasons by up to ~3.4 days versus the old fixed-year method
(measured on the 1990 test chart). Convergence is ~4 iterations/boundary (~440 `compute`
calls per chart, sub-second).

## 18. Retrograde marking convention (item 2)

**Decision:** A graha is shown **parenthesised** iff retrograde — "(Ju)" retrograde, "Ju"
direct — in the charts, the planetary table, and the PDF, per the standard convention the
assignment named. Retrograde is read from the Swiss Ephemeris **longitude speed** (now
returned by the shim; negative = retrograde). Sun and Moon are never retrograde. **Rahu and
Ketu are always marked retrograde** by tradition (vakri), even though the *true* node
momentarily turns direct near its stations. A one-line legend under the planetary table
states the convention.

## 19. Rahu/Ketu use the TRUE lunar node (item 5; supersedes #3/#15 mean-node choice)

**Decision:** Rahu is now the **true** lunar node (`SE_TRUE_NODE`), and Ketu its opposite
point, replacing the earlier mean node (`SE_MEAN_NODE`). The two differ by up to ~1.7°
(e.g. at J2000, true 123.95° vs mean 125.04°).

## 20. "As" ascendant abbreviation; South/East show sign numbers, North shows rasi (items 3,4)

**Decision:** The ascendant marker inside charts is **"As"** (ascendant) rather than "La".
The descriptive "Lagna (ascendant)" row label in the computed-values table is left unchanged
(it is a full-word label, not the in-chart abbreviation the item referred to). Fixed-sign
charts (South, East) are labelled with the **rasi number (1–12)**; the North Indian chart —
whose houses are fixed while the rasi rotates — is labelled with the **sign abbreviation**
(Ar, Ta, Ge …). This is the swap the assignment asked for (item 4).

## 21. Item 6 (ephemeris path / init) — no change, by design

**Decision:** No `swe_set_ephe_path` / init call was added. In **Moshier mode**
(`SEFLG_MOSEPH`, the mode this site runs in) Swiss Ephemeris uses its built-in analytical
theory, needs **no `.se1` data files**, and auto-initialises on the first `swe_calc_ut`
call. An ephemeris path is only consulted for `SEFLG_SWIEPH`/`SEFLG_JPLEPH`. So the
assignment's suspicion does not apply to our configuration — hence, per the item's own
instruction ("if I am wrong … do not do anything"), nothing was changed. Documented in
`vendor/sweph/se_shim.c`.

## 22. Fixed-width fonts everywhere (item 7)

**Decision:** The site font stack (`--font`) is now monospace, and the SVG charts and the
jsPDF document (switched from Helvetica to Courier) use fixed-width type too, so planetary
abbreviations and tabular figures align.

---

# v0.4.1 decisions (follow-up fixes)

Assignment `work-assignment/v0.4.1.txt`: four reported issues + one enhancement.

## 23. Cache-busting `?v=` on all local assets (fixes the "not fixed yet" reports)

**Symptom:** after v0.4.0 the charts still showed "La", showed no planets, and lacked the
number/abbr swap — yet the committed code was verifiably correct (Playwright screenshots
proved it). **Root cause:** a **stale browser cache serving a partial mix** of old and new
files. Specifically, a cached old `jyotish.js` (no `.label` field) combined with the new
`result.js` (which pushes `g.label`) makes every planet label `undefined`; `[undefined].join(" ")`
is an empty string, so the charts render only the (old) "La" ascendant marker and **no
planets** — exactly the reported symptoms.

**Decision:** append a `?v=<version>` query to every local `<script>`/`<link>` in both HTML
pages, bumped each release, so a browser always loads a self-consistent set of files. Also
hardened the render path (`g.label || g.abbr`) so a version skew degrades to plain
abbreviations instead of blank labels. **Next incarnation: bump the `?v=` string every
release** (it is `0.4.1` now).

## 24. Dedicated Sun-only shim `se_sun_sid` (item 5)

**Decision:** added `se_sun_sid(tjd_ut)` to the WASM shim, returning just the Sun's sidereal
longitude (one Sun call + ayanamsa), exposed as `Astro.sunSidLon(date)`. The precise dasha
(#17) now uses it instead of a full `se_compute` per root-finding step, cutting ~13 body/house
calculations per evaluation down to 2. Verified bit-identical to the full-compute Sun value
and the dasha output is unchanged.

## 18a. Amendment to #18 — nodes are NOT always retrograde (item 3)

**Decision (revises #18):** with the **true** node, Rahu/Ketu retrograde status now follows
the **actual computed motion** (speed < 0) rather than being forced true; the true node turns
direct near its stations (e.g. 2000-01-08, speed +0.003°/day → shown direct). The planetary
table legend no longer claims "Rahu and Ketu are always retrograde."

---

# v0.4.2 decisions (details / header / date-picker refinements)

Assignment `work-assignment/v0.4.2.txt`: eight refinements.

## 25. Fixed-sign charts show HOUSE numbers, not rasi numbers (item 1; supersedes #20)

**Decision:** South and East Indian charts now label each cell with the **house (bhava)
number counted from the lagna** (1 = ascendant sign), not the fixed rasi number. This matches
the original v0.4.0 item-4 intent ("South and East … house numbers"), which #20 had
implemented as rasi numbers. Applied to **both** South and East (the v0.4.2 note flagged East,
but the same rule is correct for South); `charts.js` gained `houseNum(sign, ascSign)`.

## 26. Birth date via DD/MM/YYYY dropdowns (item 2)

**Decision:** the date is entered with three **dropdowns** (Day / Month / Year, dd/mm/yyyy
order) — consistent with the time dropdowns and unambiguously dd/mm/yyyy, which the plain
`type="date"` picker cannot guarantee across locales. Year range is **1900–2030** (covers
realistic birth dates; widen in `app.js` `populateDate` if ever needed). The "Format:
dd/mm/yyyy" hint was removed.

## 27. Only the "As" token is coloured in charts (item 3)

**Decision:** each label in a chart cell is now its own `<tspan>`; only the `As` tspan carries
the `has-lagna` (red) class, so a graha sharing the ascendant cell keeps the normal colour.
Previously the whole `<text>` row was coloured, turning co-located planets red too.

## 28. "Details" card restructured; Lagna added to the table (items 4,5,6,7,8)

**Decision:**
- The "Computed values" card is renamed **"Details"** (item 6).
- The birth date/time/place line under the page title is removed; **Gender, Date of birth,
  Time of birth, Place of birth** are shown as rows in Details instead (item 8).
- **Moon sign** shows only the sign (the nakshatra already has its own row) (item 7).
- **Lagna** in Details shows only the sign name; the full degrees now live in a new **Lagna
  (ascendant) row at the top of the planetary-positions table** (item 5).
- The "(Ju) = retrograde" legend under the table is removed (item 4).

These changes are mirrored in the PDF (`pdf.js`) so the download matches the page.

## Cache-buster

Bumped to `?v=0.4.2` in both HTML files (see #23; bump every release).

---

# v0.5.0 decisions (readability & mobile)

Assignment `work-assignment/v0.5.0.txt`: four UI items.

## 29. Base font size dropped to 14px (item 1)

**Decision:** the root font size is reduced from 16px to **14px**. The monospace stack adopted
in v0.4.0 is wider than proportional type and was wrapping values throughout; a one-step
reduction cuts the wrapping while staying readable. Component sizes are mostly `rem`-based so
they scale with it.

## 30. Birth place is a searchable native datalist (item 2)

**Decision:** the place `<select>` is replaced by a text `<input list="place-list">` backed by
a native `<datalist>`, so typing filters the cities as-you-type with no framework/library and
fully offline. The input holds the display label ("City — Region"); `app.js` keeps a
label→id map and resolves it on submit, erroring if the text doesn't match a listed place.

## 31. Planetary table stacks on mobile + zebra striping (item 3)

**Decision:** every `<td>` carries a `data-label` (the column name). At ≤560px the table
switches to a stacked, one-card-per-row layout (`thead` hidden, each `td` a label/value flex
row using `::before { content: attr(data-label) }`), removing the horizontal scroll on phones.
Rows are zebra-striped (`tbody tr:nth-child(even)` tinted with `--accent-soft`) on all widths.

## 32. Dasha summary left-aligned (item 4)

**Decision:** the maha-dasha `<summary>` switched from a CSS grid (whose leading `1fr` column,
together with the `▸` marker pseudo-element being the first grid item, pushed the lord/dates to
the right) to a left-aligned flex row. The lord gets a `min-width` so the date ranges line up.

## Cache-buster

Bumped to `?v=0.5.0` in both HTML files (see #23; bump every release).

---

# v0.5.1 decisions (combobox, native date picker, chart markers)

Assignment `work-assignment/v0.5.1.txt`: place search was broken, the date UX was wrong, and
the North/East house markers crowded the planets.

## 33. Custom combobox for the place search (item 1; supersedes #30)

**Decision:** the native `<datalist>` (from #30) is replaced by a small **vanilla-JS
combobox** — a text input plus a filtered `<ul role="listbox">`. It was unreliable: broken
filtering on desktop, and on iOS Safari the datalist surfaced as keyboard suggestions rather
than a dropdown. The combobox does case-insensitive substring filtering, supports mouse and
keyboard (↑/↓/Enter/Esc), and resolves the chosen label to the dataset id. This leaves the
strict "native elements only" convention, but the native control was not usable here.

## 34. Native date picker (`type="date"`) — supersedes #26 (three dropdowns) and #12

**Decision:** the birth date uses a native `<input type="date">` — a real calendar/wheel
selector (the iOS wheel and desktop calendar the assignment asked for), with **min
1950-01-01, max 2100-12-31**, defaulting to **today**. This replaces the v0.4.2 Day/Month/Year
dropdowns.

**Caveat (documented):** the *display* format of a native date input is controlled by the
browser/OS locale and cannot be forced from HTML/CSS/JS. For the user's locale (India /
`en-GB`-style) it shows **dd/mm/yyyy**, which is what was asked; `lang="en-GB"` is set on the
input to bias browsers that honour it. A browser set to a US locale would show mm/dd/yyyy —
the only way to *guarantee* dd/mm/yyyy display would be a fully custom calendar widget, which
was judged not worth abandoning the native picker the user explicitly requested. The internal
payload is unaffected (always ISO `YYYY-MM-DD`).

## 35. North/East house markers moved to the house corners (item 4)

**Decision:** in the North and East charts the rasi/house marker previously sat next to the
planet anchor in the middle of each house, eating the planets' space. Each chart now has a
separate **marker-position table** (`NORTH_MARK`, `EAST_MARK`) placing the marker in the
outer corner of each house (as the South chart already did), centre-anchored and a step
smaller (`.hmark`), so the planet block keeps the centre. South was already correct and is
unchanged.

## Cache-buster

Bumped to `?v=0.5.1` in both HTML files (see #23; bump every release).

---

# v0.5.2 decisions

Assignment `work-assignment/v0.5.2.txt`: four items.

## 36. Vimshottari year = 360° of TROPICAL Sun (item 4; supersedes #17)

**Decision:** the dasha "year" is now one full revolution of the Sun in **tropical** longitude
(a tropical year, mean 365.24219 d), replacing the sidereal choice of #17. This matches
**JHora**, which the user takes as authentic. The Sun fast-path shim `se_sun_sid` (sidereal)
was changed to **`se_sun_trop`** (tropical Sun longitude — also simpler, no ayanamsa step);
`Astro.sunSidLon` → `Astro.sunTropLon`; the WASM was rebuilt. The dasha *lord/start fraction*
still come from the Moon's **sidereal** nakshatra (unchanged); only the year-length mapping is
tropical. Effect vs. sidereal is ≤~1.7 days over the full 120-year span.

## 37. First maha dasha trimmed to birth (item 3)

**Decision:** the first maha dasha is the running (balance) dasha and began before birth. Its
antardashas that finished before birth are dropped, and the antardasha running at birth is
**clamped to start at the birth instant**, so the antardasha timeline begins at birth. The
maha-dasha summary still shows its true (pre-birth) start/end and nominal years — only the
antardasha list is trimmed, per the literal request.

## 38. Birth date back to Day/Month/Year dropdowns (item 1; supersedes #34)

**Decision:** the native `<input type="date">` (#34) is reverted to three **dropdowns**
(Day/Month/Year). As anticipated in #34, the native picker's display format follows the
browser/OS locale and showed **mm/dd/yyyy** for the user — which can't be forced. Dropdowns
are unambiguous dd/mm/yyyy. **Year range 1950–2100** (per the request), and all three default
to **today's** date.

## 39. Mobile planetary table = compact two-line cards (item 2; supersedes #31)

**Decision:** on ≤560px each planet renders as a two-line card via CSS grid areas — line 1:
name/abbr, position, nakshatra(pada); line 2: `Rasi: x  Navamsa: y  <karaka>`. The per-field
data-label headings from #31 are dropped; only Rasi and Navamsa carry a short inline label.
Zebra striping and "no horizontal scroll" are retained.

## Cache-buster

Bumped to `?v=0.5.2` in both HTML files (see #23; bump every release).

---

# v0.5.3 decisions

Assignment `work-assignment/v0.5.3.txt`: five items — smaller Details font, Details as
alternating two-line rows (mobile only), dasha start from birth, planetary-table column
alignment on mobile, remove print.

## 40. Details: mobile-only stacked rows with alternating shading (items 1,2)

**Decision:** desktop's `dl.values` (side-by-side grid) is untouched — the assignment said
desktop already looks good. At `≤560px` only, `dl.values` switches to `display: block`,
each `dt`/`dd` becomes its own block line (label, then value, matching the requested "Sun
sign — Vedic (sidereal)" / "Gemini" two-line example), font drops to `0.85rem`, and every
other **pair** (`dt:nth-of-type(even)` + `dd:nth-of-type(even)`) gets the `--accent-soft`
tint. This works because `dt`/`dd` always alternate 1:1, so `:nth-of-type(even)` on each
tag lands on the same logical row pair.

## 41. First maha dasha's own start date clamped to birth (item 3; extends #37)

**Decision:** v0.5.2 #37 only trimmed the **antardashas** of the running (balance) maha
dasha to start at birth, leaving the maha-dasha summary's own `start` at its true pre-birth
value (e.g. "24 May 1989" for a MD that actually began before birth). This session's item 3
asks for the **maha dasha's** displayed start to also read from birth — exactly the
follow-up the v0.5.2 handoff anticipated ("if a future ask wants the MD itself to start at
birth… change the summary too"). `Jyotish.vimshottari` now clamps
`mahadashas[0].start = birthDate` when it precedes birth. `end` and the nominal `years`
label are left as-is (literal reading: only the *starting date* was asked to change).
Verified headlessly: for the 1990-05-15 08:30 IST test chart, MD0 (Sun) now shows
"15 May 1990 – 25 May 1995", matching the birth date exactly; the full 120-year span from
the true (unclamped) balance-start is unchanged and antardashas stay monotonic.

## 42. Planetary table: fixed `ch`-width mobile columns instead of `auto` (item 4)

**Decision:** each planet card in the ≤560px table is its own CSS Grid container
(`display: grid` per `<tr>`), so `auto`-sized columns were sized independently per row —
"Jupiter"'s wider name column made column 1 wider in that row than in the "Sun" row, so
nothing lined up vertically down the page. Changed `grid-template-columns` from
`auto auto 1fr` to fixed `13ch 14ch 1fr` (monospace, so `ch` is exact), which forces every
row's grid to use identical track widths regardless of that row's content — verified via
Playwright (`getComputedStyle` on every `<tr>` returns the same three pixel widths).

## 43. Print removed (item 5)

**Decision:** the `#print-btn` (and its `window.print()` handler) is deleted from
`result.html`/`result.js`. The `@media print` stylesheet and the `.no-print` class are left
in place — they're a defensive fallback for a user invoking the browser's native Ctrl+P,
not an "option" the site offers, so removing the button satisfies the request without
touching CSS that costs nothing to keep.

## Cache-buster

Bumped to `?v=0.5.3` in both HTML files (see #23; bump every release).
