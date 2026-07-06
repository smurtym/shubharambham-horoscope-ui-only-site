# Session log — v0.3.2 (2026-07-06) — IMPLEMENTED the Moshier-Moon accuracy study

Assignment: `work-assignment/v0.3.2.txt` — "The plan outline in session-v0.3.1.md good. Now
let's implement this." So this session **builds and runs** Plan A and reports the measured
numbers. (Ties to `[[session-v0.3.1]]` = the plan, `[[session-v0.3.0]]` = the four-plan survey.)

No human answered questions mid-session (per `CLAUDE.md`). Autonomous decisions logged below.

---

## 0. Headline result (this is the answer to the whole v0.3.x question)

Over **1950–2100, sampled every UTC minute (78,893,280 samples)**, the Moshier Moon's
**ecliptic-longitude** error vs. Swiss Ephemeris (DE431) is:

| metric | value |
|--------|-------|
| **maximum error (whole 150 yr)** | **3.41″ = 0.0569 arc-minute**, at **2068-03-03 06:30 UTC** |
| mean | 0.569″ |
| RMS | 0.709″ |
| median (p50) | 0.49″ |
| p99 | 1.81″ |
| p99.9 | 2.40″ |
| p99.99 | 2.92″ |
| % of timeline > 1″ | 15.7 % |
| % of timeline > 2″ | 0.51 % |
| % of timeline > 5″ (and > 0.5′, > 1′, > 3′ …) | **0.0000 %** |

**So the maximum Moshier Moon longitude error over 1950–2100 is ≈ 0.057′ — comfortably
below the ~0.1′ figure in `vendor/sweph/README.md`.** The user's suspicion that "it's more
than 0.1 arc-minute" is **not** borne out: the true worst case is a bit over *half* of 0.1′,
and it never once exceeds even 5″ in 78.9 million minutes. This is consistent with the
published Swiss Ephemeris claim ("a few arc seconds … around 3 arcseconds" vs DE, and "0.5″
relative to DE404"): our max-vs-DE431 of 3.4″ sits right in that band.

**Practical meaning for the app:** a nakshatra pada is 3°20′ = **12 000″**; the worst Moshier
Moon error (3.4″) is ~**3500× smaller** than a pada, ~14 000× smaller than a nakshatra. It can
only ever matter if a birth Moon sits within a few arc-seconds of a pada cusp. No site change
is warranted (and none was made — this session only added the `research/` study).

---

## 1. What "let's implement this" produced

A new **`research/`** tree (a sibling toolset, **not** loaded by the site — the site stays
Moshier-only / data-file-free). Layout and full run instructions are in `research/README.md`.

| File | Role |
|------|------|
| `research/moon-moshier/sweep.c` | The C differential sweep (details §2). |
| `research/moon-moshier/Makefile`, `fetch-sweph.sh` | Build against pinned Swiss Ephemeris 2.10.03 sources. |
| `research/moon-moshier/merge.py` | Additive merge of parallel year-chunks → final stats. |
| `research/moon-moshier/analyze.py` | Report + dependency-free `envelope.svg`. |
| `research/ephe/semo_18.se1`, `sepl_18.se1` | DE431 reference (1800–2399), committed → self-contained. |
| `research/moon-moshier/results/` | **Committed outputs:** `summary.json`, `maxima.csv` (top-300 peaks), `envelope.svg` (daily-max over 1950–2100), `daily_max.csv.gz`. |

## 2. Method as actually implemented (matches the v0.3.1 plan + locked decisions)

- Reference/gold standard = **SWIEPH** (`SEFLG_SWIEPH`, `semo_18.se1` = 0.001″ compression of
  DE431). Compared body = **Moshier** (`SEFLG_MOSEPH`).
- **Geocentric, longitude only, `SEFLG_NONUT` on both.** Error = `|wrap180(lonM − lonS)|·3600` ″.
- **UTC grid, ΔT cancels:** both bodies via `swe_calc_ut(jd_ut, …)`, so sweph forms
  `TT = UT + ΔT(jd_ut)` identically for each mode and ΔT drops out of the difference — exactly
  as argued in v0.3.1 §3. No manual UTC→TT conversion needed; verified by construction.
- **Grid:** every 1 minute, 1950-01-01 → 2100-01-01 UTC = **78,893,280 samples** × 2 modes =
  157.8 M `swe_calc_ut` calls.
- **Streaming stats** (no 80 M-row store — per v0.3.1, the flat/streaming route beats the
  SQLite idea): a 0.001″-bin histogram to 120″ (+overflow) for percentiles; threshold
  counters for the survival table; running global max; per-day max (envelope); and
  **golden-section-refined** local maxima (top-300 kept in a heap) for the peak catalogue.
- **Peak refinement:** each grid-detected local max is refined with golden-section on the
  continuous time axis (sub-second) — this is the "better than pure grid" step from v0.3.1 §5.
  The reported global max (3.41255″) is the refined value.

**Decision (autonomous):** ran the sweep as **4 parallel processes over disjoint year-chunks**
(1950-1988 / 1988-2025 / 2025-2063 / 2063-2100) + `merge.py`, because Swiss Ephemeris keeps
one global (non-thread-safe) state so separate processes are the safe way to use the 4 cores.
Wall time ≈ 15 min instead of ~60 min single-thread. Merge is pure addition of the histogram
and counters + max-of-chunk-maxima, so it is exact, not approximate.

## 3. Where the worst errors live (geometry)

The top-300 local maxima cluster tightly at **perigee-syzygy**: the global peak (2068-03-03)
is at Sun–Moon elongation ≈ 350° (near **new moon**) with Moon distance 0.00238 AU (near
**perigee**, the min of the ~0.00238–0.00271 AU range). Mean angular distance of the top-300
peaks from a syzygy (0°/180°) is only ~11°. Interpretation: Moshier's truncation of the
short-period lunar terms (evection, variation, parallactic inequality) hurts most when the
Moon is closest and the Sun's perturbation is strongest — i.e. new/full moon at perigee. The
`envelope.svg` shows the daily-max error breathing between ~1.5″ and ~3.4″ with the
~8.85-yr apsidal / 18.6-yr nodal beats.

## 4. Verification / sanity

- **1-year validation run (2000)** before the full sweep: max 2.08″, mean 0.59″ — in-band,
  and the per-minute machinery, histogram, thresholds and refinement all behaved.
- **Cross-check of the merge:** chunk-4's own refined max (3.412550″ @ 2068-03-03 06:30:27.353)
  equals the merged global max → the merge picked the right peak; the other chunk maxima
  (3.01″/3.18″/2.87″) are all consistent and smaller.
- **Published-bound check (v0.3.0 §2):** measured 3.4″-vs-DE431 agrees with the documented
  "few arcsec / ~3″" Moshier-Moon figure → no harness/convention bug (the v0.3.1 pitfalls —
  UT/TT mixing, longitude wrap, geo/topo — were all avoided; a mistake in any would have
  produced tens of arcsec to ~1°, not 3.4″).
- Percentiles are histogram-derived (± one 0.001″ bin); `semo*.se1` 27.55-day boundary
  artifacts (<< 0.01″) were excluded by the 0.05″ local-max floor.

## 5. Reproduce

```bash
cd research/moon-moshier && ./fetch-sweph.sh && make SWEPH_SRC=./swisseph
# parallel (4 cores, ~15 min):
./sweep ../ephe 1950 1988 1 out/c1_ & ./sweep ../ephe 1988 2025 1 out/c2_ &
./sweep ../ephe 2025 2063 1 out/c3_ & ./sweep ../ephe 2063 2100 1 out/c4_ & wait
python3 merge.py out/merged out/c1_ out/c2_ out/c3_ out/c4_
python3 analyze.py out/merged
```
Bulk outputs (`sweep` binary, `swisseph/`, `out/`, `full/`) are git-ignored; the curated
results are committed under `results/`.

## 6. Answers to the specific questions asked

- *"Times where max error occurs & the max?"* → **3.41″ (0.057′) at 2068-03-03 06:30 UTC**;
  full local-maxima catalogue with geometry in `results/maxima.csv`; the envelope over all
  150 yr in `results/envelope.svg` + `daily_max.csv.gz`.
- *"% of 1-min samples over 3′, 1′, 0.5′ …?"* → all **0.0000 %** (nothing is even > 5″).
  Adding fine arc-second buckets (as recommended in v0.3.1) makes it legible: **15.7 % > 1″,
  0.51 % > 2″, 0 % > 5″**.
- *"80 M minutes in SQLite?"* → not needed; computed **streaming** in C (constant memory).
  The whole run is ~15 min and stores only a histogram + small CSVs, not 2.8 GB of rows.
- *"Golden-section / Brent or better?"* → implemented **golden-section refinement** of
  grid-detected peaks; the reported max is the refined value.
- *"research/ dir + toolchain?"* → built exactly that: **C sweep** over vendored sweph sources
  + **Python** (numpy) merge/analyze; DuckDB not needed at this data size.

## 7. Suggested follow-ups (not done — would need their own assignment)

- Optionally add a one-line empirical note ("measured max 0.057′ over 1950–2100, DE431") to
  `vendor/sweph/README.md` next to the "~0.1′" claim. Left untouched this session to keep the
  site out of a research task.
- If ever wanted: independent **Plan B** cross-check vs. JPL **DE440** via SPICE/Horizons at
  the 2068-03-03 peak (would confirm SWIEPH isn't hiding a shared-code bias). Expected to
  agree to << 0.01″.

## Git state

- Branch `v0.3.2`, off `v0.3.1`. Commits: assignment text; the `research/` tooling; and this
  log + curated `results/`. **No site/source changes** — only the new `research/` tree.
  Pushed to `origin/v0.3.2`. No PR (process: human monitors via GitHub).
