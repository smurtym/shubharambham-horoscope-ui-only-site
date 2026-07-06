# Session log — v0.4.0 (2026-07-06) — portal bug-fix batch

Handoff for the next AI incarnation. Read `CLAUDE.md` first (the work process), then the
earlier `ai-work-sessions/session-*.md` for history, then this file.

Assignment: `work-assignment/v0.4.0.txt` — **13 numbered fixes** to the live portal. Unlike
the research-only v0.3.x sessions, this one changes the site. No human answered questions;
autonomous decisions are logged in `Decisions.md` (#16–#22).

## 0. What changed, per assignment item

| # | Item | Done | Where |
|---|------|------|-------|
| 1 | East Indian chart anti-clockwise | ✅ authentic layout: Aries top-centre, signs fixed, **anti-clockwise** (Wikipedia). Replaces the old clockwise guess. | `js/charts.js` `EAST_CELLS`; Decisions #16 |
| 2 | Retrograde shown, parenthesised `(Ju)` | ✅ from Swiss Ephemeris longitude speed; in charts, table, PDF; legend added | shim + `js/astro.js`, `jyotish.js`, `result.js`, `pdf.js`, `charts.js`; Decisions #18 |
| 3 | "As" ascendant marker (not "La") | ✅ chart marker is `As`; computed-values row "Lagna (ascendant)" left as-is | `js/charts.js`; Decisions #20 |
| 4 | North=rasi abbr, South/East=numbers | ✅ swapped | `js/charts.js`; Decisions #20 |
| 5 | Rahu/Ketu = **true** node | ✅ `SE_TRUE_NODE` (was mean) | `vendor/sweph/se_shim.c`; Decisions #19 |
| 6 | Ephemeris path / init | ⚠️ **no change, by design** — not needed in Moshier mode (see below & Decisions #21) | documented only |
| 7 | Fixed-width fonts everywhere | ✅ site font stack, SVG charts, PDF (Courier) | `css/styles.css`, `js/charts.js`, `js/pdf.js`; Decisions #22 |
| 8 | Precise Vimshottari via solar longitude | ✅ 360°/dasha-year of the Sun's **sidereal** motion, Newton–Raphson | `js/jyotish.js` `vimshottari`, `js/result.js`; Decisions #17 |
| 9 | Example name Ramesh → **Ram** | ✅ | `index.html` |
| 10 | Remove seconds input | ✅ field gone; payload seconds always `:00` | `index.html`, `js/app.js` |
| 11 | HH/MM dropdowns, hours "14 (2 PM)" | ✅ generated in JS | `index.html`, `js/app.js` |
| 12 | Date input dd/mm/yyyy | ✅ text field + validated parse | `index.html`, `js/app.js` |
| 13 | Tithi % remaining | ✅ "Krishna Ashtami (45% remaining)" | `js/jyotish.js` `tithi`, `result.js`, `pdf.js` |

## 1. Item 6 — why nothing was done (the assignment invited this)

The site runs Swiss Ephemeris in **Moshier mode** (`SEFLG_MOSEPH`): built-in analytical
theory, **no `.se1` data files**, auto-initialised on the first `swe_calc_ut` call. An
ephemeris path (`swe_set_ephe_path`) is consulted **only** for `SEFLG_SWIEPH`/`SEFLG_JPLEPH`.
So there is no dummy path to set and no init function to call for our configuration. The
assignment explicitly said "if I am wrong … do not do anything for this item," so nothing was
changed. This is recorded in `se_shim.c`'s header and Decisions #21.

## 2. The WASM was rebuilt (items 2 & 5)

`vendor/sweph/se_shim.c` changed and `vendor/sweph/sweph.js` was **recompiled** with the same
pinned toolchain (Swiss Ephemeris 2.10.03, Emscripten 4.0.13) and the exact `build.sh` flags.
Changes: Rahu uses `SE_TRUE_NODE`; the shim now also returns each body's **longitude speed**
(`out[13..22]`), so `se_compute` fills **23** doubles (was 13). `js/astro.js` reads the extra
speeds and sets `retro` per body (Sun/Moon never; nodes always; others = speed < 0).

Sources for the rebuild were taken from a local clone at
`/astro/shubharambham-ai/vendor/swisseph` (no network needed). Build/verify artifacts live in
the session scratchpad, **not committed** (only the built `sweph.js` + shim are in the repo,
as before).

## 3. Item 8 — how the precise dasha works

`Jyotish.vimshottari(birthDate, moonLonSid, { sunLon0, sunLonAt })`. A dasha "year" = one
**360° sidereal revolution of the Sun**. A boundary at dasha-age *A* (years since the first
Maha Dasha started) is the instant the Sun's sidereal longitude has advanced *(A−elapsed)·360°*
from birth (where `elapsed` = the fraction of the first dasha already run at birth). Solved by
Newton–Raphson on calendar time, seed = mean sidereal year (365.256363 d), slope = mean solar
speed; ~4 iterations/boundary. `result.js` injects `sunLonAt` = sidereal Sun longitude from
`Astro.compute`. Without the callback (e.g. a headless unit test) it falls back to mean
sidereal years, preserving old behaviour. Cost ≈ 440 `compute` calls/chart (sub-second).

## 4. How it was verified (reproduce before shipping changes)

- `node --check` on every `js/*.js` — all pass.
- **Headless numeric test** (Node build of the shim, `swephbuild/itest.mjs` in scratchpad):
  1990-05-15 08:30 IST → Sun 0° Ta, ayanamsa 23.7151, asc 9° Ge — matches the v0.1/v0.2
  hand-checked baseline. **True node** Rahu 16° Cp (mean would differ ~1°). Retrograde flags:
  Mercury/Saturn/Rahu/Ketu retrograde, Sun/Moon/…direct (spot-checked 2020-09-10: Mars,
  Jupiter, Saturn, Uranus, Neptune retrograde as in reality). Tithi "Krishna Panchami (12%
  remaining)". Dasha **monotonic**, total span **exactly 120 sidereal years**; precise-vs-
  fixed-year deviation up to **3.38 days** on antardashas landing in other seasons (proves the
  feature is doing real work).
- **Playwright E2E from `file://`** (Chromium, `~/.cache/ms-playwright`): drove the real
  home-page form (dd/mm/yyyy input, "14 (2 PM)" hour dropdown, no seconds field), submitted,
  rendered the result page. Confirmed retrograde parens in the table `(Me) (Sa) (Ra) (Ke)`,
  the retro legend, all three chart formats render, 9 mahadashas, and a valid **3-page PDF**
  (`%PDF`, ~2.5 MB), with **zero console/page errors**. Screenshots of all three charts + the
  full page + PDF page 1 were eyeballed: the **East chart numbers run anti-clockwise** (top
  edge 2·1·12), the North chart shows rasi abbreviations, South/East show numbers, "As" marks
  the ascendant cell, monospace throughout, PDF columns fit under Courier (no overflow).

## 5. Git state

- Branch `v0.4.0`, based off `v0.3.2`. Commits: assignment text; the implementation +
  rebuilt WASM; docs (Decisions #16–#22, `vendor/sweph/README.md`) + this handoff. Pushed to
  `origin/v0.4.0`. No PR opened (process: human monitors via GitHub; open one if asked).
- `main` untouched.

## 6. Deferred / notes for next time

- The precise-dasha cost (~440 WASM calls) is fine but could be trimmed with a Sun-only shim
  export if ever needed. Antardasha date ranges in the UI are still Maha→Antar only (deeper
  levels remain deferred, per v0.1.0 #10).
- The East Indian corner-triangle *diagonal* direction follows the pre-existing frame; if a
  specific regional variant is ever required, only `EAST_CELLS` + the corner `line()`s need
  adjusting. The sign order (anti-clockwise, Aries top-centre) is the well-sourced invariant.
- All earlier deferrals still stand (divisional charts D2–D60, localization, user-selectable
  ayanamsa, larger place dataset, a committed automated test suite). Not deployed (standing
  instruction).
