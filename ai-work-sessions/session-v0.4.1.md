# Session log — v0.4.1 (2026-07-06) — follow-up fixes to v0.4.0

Handoff for the next incarnation. Read `CLAUDE.md`, then `session-v0.4.0.md`, then this.

Assignment: `work-assignment/v0.4.1.txt` — four reported issues + one enhancement, following
the v0.4.0 portal batch.

## 0. The key finding: v0.4.0's chart code was correct; the browser was serving stale files

The user reported three chart problems (still shows "La"; no planets in charts; number/abbr
swap "not done"). But the v0.4.0 committed code was verifiably correct — the working tree
matched HEAD and fresh Playwright screenshots showed "As", all planets, and the swap.

**Root cause: a stale, partially-cached set of JS files.** With a cached old `jyotish.js`
(no `.label` field) but the new `result.js` (which pushes `g.label`), every planet label
becomes `undefined`; `[undefined].join(" ")` → `""`, so charts render only the old "La"
ascendant marker and **no planets**, and the old `charts.js` shows no number/abbr swap —
matching all three symptoms precisely. (Items 3 & 5, about retrograde detail and calculation
count, confirmed the user *was* otherwise on the new code.)

## 1. What changed (per item)

| # | Item | Fix |
|---|------|-----|
| 1 | Charts still show "La" | **Cache-busting** — see below. Committed code already renders "As". |
| 2 | No planets in charts | Same stale-cache root cause. Cache-busting + a `g.label \|\| g.abbr` fallback so a version skew degrades to plain abbreviations instead of blank labels. |
| 3 | Rahu/Ketu not always retrograde with true node | Removed the forced always-retro; retro now follows the true node's actual speed. Legend no longer says "Rahu and Ketu are always retrograde". |
| 4 | Numbers (S/E) vs abbr (N) "not done" | Same stale-cache root cause; committed code already does it. Fixed by cache-busting. |
| 5 | Separate Sun shim to cut calculations | New `se_sun_sid` WASM export → `Astro.sunSidLon(date)`; the precise dasha uses it (2 sweph calls/step instead of ~13). |

**Cache-busting:** every local `<script>`/`<link>` in `index.html` and `result.html` now
carries `?v=0.4.1`. **Bump this string on every future release** so browsers never load a
stale mix of files. (Decisions #23.)

## 2. WASM rebuilt again

`vendor/sweph/se_shim.c` gained `se_sun_sid()`; `build.sh` exports `_se_sun_sid`;
`vendor/sweph/sweph.js` recompiled (same pinned Swiss Ephemeris 2.10.03 / Emscripten 4.0.13).
`js/astro.js` cwraps it and exposes `Astro.sunSidLon(date)` (reuses the output heap buffer;
safe because it is never called concurrently with `compute`).

## 3. Verification

- `node --check` on every `js/*.js` — pass.
- **`se_sun_sid` is bit-identical** to `full compute Sun − ayanamsa` at J2000 (diff 0.0).
- **Item 3**: scanned 2000; the true node is **direct** on 2000-01-08 (speed +0.0034°/day) →
  the astro layer reports `Rahu.retro = Ketu.retro = false`, confirming nodes are no longer
  forced retrograde.
- **Playwright E2E from `file://`** (with the cache-busted pages + new WASM): full form flow,
  result renders, charts show all planets + "As" + numbers/abbr swap, retrograde parens
  `(Me) (Sa) (Ra) (Ke)` (these are retrograde on the 1990 test date), 9 mahadashas with the
  **same** dates as v0.4.0 (proving the `sunSidLon` fast path matches the full-compute path),
  valid 3-page PDF, **zero console/page errors**.

## 4. Git state

- Branch `v0.4.1`, off `v0.4.0`. Commits: assignment text; the fixes + rebuilt WASM; docs
  (Decisions #23/#24/#18a, `vendor/sweph/README.md`) + this handoff. Pushed to `origin/v0.4.1`.
  No PR (process: human monitors via GitHub).
- `main` untouched.

## 5. Note for next time

- **Bump the `?v=` cache-buster** in both HTML files on every release. This is the durable fix
  for the "I don't see my change" class of report on this static, no-build, `file://` site.
- If the user still sees stale output after pulling, ask them to hard-reload / clear cache
  once (the `?v=` bump handles it automatically thereafter).
