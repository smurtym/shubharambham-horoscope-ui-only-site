# Session log — v0.2.0 (built 2026-07-06)

Handoff for the next AI incarnation. Read `CLAUDE.md` first (it documents the work process),
then `ai-work-sessions/session-v0.1.0.md` for the code map, then this file.

## What the task was

From `work-assignment/v0.2.0.txt`. Two things:

1. **Establish + document the work process.** Going forward, work is assigned via text files
   in `work-assignment/`; no human answers questions mid-session. Each session: read
   `ai-work-sessions/` for history, read `work-assignment/` for what's pending, make
   autonomous decisions and log them to `Decisions.md`, work on a per-assignment branch with
   frequent commits/pushes, and write a session summary here at the end. This is now written
   up in **`CLAUDE.md`** — the durable home for the process.
2. **Use Swiss Ephemeris.** "emcc is already installed … git clone official swiss ephemeris
   and plug into the site." I.e. finally do what v0.1.0 decision #1 deferred: replace the
   pure-JS ephemeris with a real Swiss Ephemeris WASM build.

## What got built (all on branch `v0.2.0`, pushed to origin)

The v0.1.0 pure-JS ephemeris is **retired**. The astronomy layer is now the real Swiss
Ephemeris, compiled to WebAssembly. Nothing downstream (Jyotish, charts, dasha, PDF, UI)
changed — the `Astro.*` interface was preserved.

| File | Change |
|------|--------|
| `CLAUDE.md` | **New.** The working agreement / per-session process (see above). |
| `vendor/sweph/sweph.js` | **New.** Swiss Ephemeris 2.10.03 compiled to WASM (Emscripten 4.0.13), Moshier mode, `SINGLE_FILE=1` (wasm inlined as base64, one ~565 KB file). Defines global `SwephModule` factory. |
| `vendor/sweph/se_shim.c` | **New.** The C entry point we wrote: one `se_compute()` filling a flat array of 13 doubles (9 planets + Rahu + ayanamsa + ascendant + obliquity). |
| `vendor/sweph/build.sh` | **New.** Reproduces `sweph.js` from official sources + shim. |
| `vendor/sweph/README.md`, `LICENSE.swisseph` | **New.** Build provenance + AGPL licence. |
| `js/astro.js` | **Rewritten.** Thin wrapper over `SwephModule`. Same `compute()` output shape; adds `Astro.ready()` → Promise for async WASM init. Old JS engine (Keplerian tables, Meeus Moon series, etc.) deleted. |
| `js/result.js` | `main()` now `Astro.ready().then(...)` before `buildModel()`; render body factored into `render(model)`. |
| `result.html` | Loads `vendor/sweph/sweph.js` before `js/astro.js`. |
| `Decisions.md` | Appended decisions **12–15** (see below); #1 marked superseded. |

## Key decisions (full text in Decisions.md #12–15)

- **12.** Swiss Ephemeris WASM replaces the pure-JS engine; supersedes v0.1.0 #1 (emcc is now
  available, which is what #1 lacked).
- **13.** **Moshier mode** (`SEFLG_MOSEPH`) — no `.se1` data files. Keeps the site static /
  offline / `file://`. Sub-arcsecond planets, Moon within ~0.1′.
- **14.** **`SINGLE_FILE=1`** — wasm inlined into the JS, because browsers block `fetch()` of
  a sibling `.wasm` under `file://`. Loads from a plain `<script>`, no network/file I/O.
- **15.** Async load, **synchronous compute**. New `Astro.ready()`; `Astro.compute()` shape
  unchanged. Ayanamsa still True Chitrapaksha; Rahu still mean node (matching v0.1.0 #2/#3).

## How it was verified (reproduce before shipping changes)

- `node --check` on every `js/*.js` — all pass.
- **Numerical cross-check** (throwaway Node build of the same C, `SEFLG_MOSEPH`): J2000 gives
  Sun 280.37°, Jupiter 25.25°, Saturn 40.40°, mean-node Rahu 125.04°, ayanamsa 23.836° — all
  match reference ephemerides. sweph vs. the old JS engine (1990 Hyderabad) agreed to a few
  arcminutes (worst: Saturn ~4′, Jupiter ~3′) — the JS truncation error the swap removes.
- **Playwright E2E from `file://`** (headless Chromium at
  `/astro/shubharambham-ai/node_modules/playwright`, browsers in `~/.cache/ms-playwright`):
  drove `result.html?d=<base64>` for 1990-05-15 08:30 IST Hyderabad. Confirmed the WASM loads
  from `file://` (SINGLE_FILE, no fetch), the chart renders, **zero console/page errors**.
  Rendered Sun = 0°19′ Taurus / Krittika pada 2, ayanamsa 23.7151 — matches v0.1.0's
  hand-checked values. South + North charts (2 SVGs each), the 9-mahadasha `<details>`
  accordion, and **PDF** (valid `%PDF`, 3 pages, ~2.5 MB) all work.

Verification scripts (`test_sweph.js`, `e2e.js`, `e2e2.js`) and throwaway Node builds were
kept in the session scratchpad, **not committed**. The swisseph source clone also lives in
the scratchpad, not the repo — only the built artifact + shim + build script are committed.

## Git state

- Branch `v0.2.0`, based off `v0.1.0` (which included the `ai-work-sessions1`→`ai-work-sessions`
  typo-rename). Pushed to `origin`, tracking `origin/v0.2.0`. Three commits: docs+WASM
  artifact, the integration, and this handoff+decisions. **No PR opened** (per the process,
  the human monitors via GitHub; open one if asked).
- `main` untouched. `v0.1.0` untouched apart from being the base.

## Deferred / next steps (known gaps, not bugs)

- **Full JPL-data ephemeris:** if maximum accuracy is ever wanted over Moshier, one could
  ship the `.se1` files and drop `SEFLG_MOSEPH` — but that breaks the no-data-files /
  `file://` constraint, so Moshier is the right default here. Left as a conscious trade.
- **`index.html`** does not load sweph (only `result.html` needs positions) — correct today;
  revisit if the home page ever needs live calculations.
- All v0.1.0 deferrals still stand: divisional charts D2–D60, deeper dasha levels
  (Pratyantar+), localization, user-selectable ayanamsa, East-Indian regional reconciliation,
  expanding the 60-city place dataset, a committed automated test suite.
- Not deployed (per standing instruction). Deploy target per README is CloudFront serving
  these static files.
