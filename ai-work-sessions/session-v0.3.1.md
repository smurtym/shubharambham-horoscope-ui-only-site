# Session log — v0.3.1 (2026-07-06) — RESEARCH ONLY, no code changes

Assignment: `work-assignment/v0.3.1.txt`. Follow-up to v0.3.0. Still **research only — "just
write plan," no code changes.** The user reviewed v0.3.0 and locked the design decisions;
this session turns Plan A into a concrete, executable measurement plan and answers the
specific questions asked.

No human answering questions mid-session (per `CLAUDE.md`). This document is the deliverable.

---

## 0. Decisions the user has locked in (my inputs for this plan)

- **Plan A** (same-library differential sweep) is the approach.
- **Reference / gold standard = Swiss Ephemeris SWIEPH mode** (`.se1`, a 0.001″ compression
  of JPL DE431). Good enough as truth; no external JPL needed for the primary run.
- **Longitude only** (ecliptic). No latitude. (Correct: nakshatra/pada depend on longitude.)
- **Sample in UTC**, not TT — convert UTC→TT only if the chosen API needs it (see §3).
- **Geocentric**, **no-nutation** flag on **both** sides.
- Wants: (a) the **times of maximum error and the max value**; a catalogue of **local maxima**
  across 1950–2100; (b) with **one sample per minute** (~79 M samples), the **% of samples**
  exceeding thresholds (>3′, >1′, >0.5′, …). (c) Idea: compute all ~80 M minutes, **store in
  SQLite**, query as needed. (d) Asks whether **golden-section / Brent** or other methods are
  better. (e) Plans a **`research/`** directory for these programs (separate from the app);
  wants a **toolchain** recommendation.

Grid check: 1950-01-01 → 2100-01-01 = 54,787 days = **78,893,280 minutes (~78.9 M)**, i.e.
~**157.8 M** Swiss Ephemeris evaluations (two modes per minute).

---

## 1. TL;DR / recommendations

1. **Toolchain:** write the heavy sweep in **C**, linking the Swiss Ephemeris sources we
   already vendored (`vendor/sweph/*.c`) — native, ~**13 min single-thread**, minutes with
   threads. Do refinement + analysis + plots in **Python** (`pyswisseph`, `numpy`, `scipy`,
   `matplotlib`, `duckdb`). (A pure-Python sweep with `pyswisseph` also works but is ~30–90
   min for 158 M calls — fine if you prefer one language.)
2. **Don't put 79 M rows in SQLite.** The samples lie on a *regular* minute grid, so the row
   index *is* the timestamp — store just the error as a **flat `float32` array (~316 MB,
   memory-mapped)**, or **Parquet + DuckDB**. Row-based SQLite would be ~**2.8 GB** and slow
   to scan. Reserve SQLite for the *small* derived tables (local-maxima catalogue, threshold
   summary), where ad-hoc SQL is genuinely handy.
3. **Compute the histogram by streaming**, not by storing-then-querying: one pass, increment
   per-threshold counters and track a running max + local-maxima candidates. O(1) memory,
   exact. Store the full array *only if* you also want ad-hoc re-querying later.
4. **Two-stage max finding beats a pure grid:** detect local-maxima candidates on the minute
   grid (a minute higher than both neighbours), then **Brent / golden-section refine** each
   candidate on the *continuous* time axis to get the true peak time to sub-second and a
   slightly higher true peak value than any grid point. Best of both: the per-minute
   histogram *and* exact peaks.
5. **Expected reality check:** from published theory (v0.3.0) Moshier's Moon is ~0.5–3″ vs DE.
   The user's thresholds are in **arc-minutes** (1′ = 60″), so **almost 100 % of samples will
   likely fall *under* even the 0.5′ bucket** — the arcmin histogram may read ~0 % everywhere.
   **Add fine arcsec buckets** (>1″, >2″, >5″, >10″, >30″, >60″, >120″) or the result won't be
   legible. If instead the arcmin buckets light up, that is the smoking gun the user suspects.

---

## 2. `research/` directory + toolchain plan

`research/` is a **sibling toolset, unrelated to the shipped site** (the site stays
Moshier-only, data-file-free). Proposed layout:

```
research/
  README.md                 # purpose, how to run, sweph 2.10.03, .se1 provenance + flags
  ephe/                     # semo_18.se1, sepl_18.se1  (1800-2399; ~1.3 MB each)
  moon-moshier/
    sweep.c                 # the C differential sweep -> stats + float32 array
    Makefile                # links vendor/sweph/*.c, native gcc -O3 -march=native
    refine.py               # Brent/golden-section local-maxima refinement (scipy)
    analyze.py              # histograms, percentiles, local-maxima catalogue, plots
    query.sql               # canned DuckDB/SQLite queries
  data/                     # outputs (gitignored): err.f32, maxima.sqlite, *.png, summary.json
```

**Toolchain rationale**

| Layer | Choice | Why |
|-------|--------|-----|
| Heavy sweep (158 M evals) | **C**, reusing `vendor/sweph/*.c` | Fastest (~13 min ST, ~2–3 min on 8 cores by year-chunks); reuses code we already built & pinned; no per-call binding overhead |
| Ephemeris access | Swiss Ephemeris **native** (`swecl.c` etc.), `swe_set_ephe_path("research/ephe")` | Same library gives MOSEPH and SWIEPH from one call site; conventions cancel |
| Bulk storage | **flat `float32`** (mmap) or **Parquet** | 316 MB vs 2.8 GB SQLite; numeric-columnar scans in seconds |
| Ad-hoc queries / percentiles | **DuckDB** over Parquet/array | Vectorized; computes percentiles/histograms over 79 M rows in seconds; SQL like SQLite but built for analytics |
| Refinement | **Python + SciPy** (`minimize_scalar`, method="bounded"/Brent, or `golden`) | Cheap to Brent-refine a few thousand candidates; easy |
| Analysis / plots | **Python** (`numpy`, `pandas`, `matplotlib`) | Standard |
| Small derived tables | **SQLite** (`maxima`, `thresholds`) | Convenient SQL, tiny data |

**Reproducibility:** pin Swiss Ephemeris **2.10.03**; commit or fetch-script the two `.se1`
files (they're small — committing `semo_18.se1`, `sepl_18.se1` is fine and keeps the study
self-contained); record exact `iflag`, epoch-grid definition, and compiler flags in
`research/README.md`.

*(If the user prefers a single language: `pyswisseph` does everything — same flags — at the
cost of a slower sweep. Recommend C for the sweep, Python for the rest.)*

---

## 3. Exact measurement method

**Per sample (each UTC minute `t_i`, i = 0 … 78,893,279, `t_0` = 1950-01-01 00:00:00 UTC):**

1. `jd_ut = swe_julday(...)` for `t_i` (or `t_0_jd + i/1440.0`). Grid defined in **UTC**.
2. **Call the Moon twice, both via `swe_calc_ut` (UT-based):**
   - `swe_calc_ut(jd_ut, SE_MOON, SEFLG_MOSEPH | SEFLG_NONUT, xm, serr)`
   - `swe_calc_ut(jd_ut, SE_MOON, SEFLG_SWIEPH | SEFLG_NONUT, xs, serr)`
   Geocentric (no `SEFLG_TOPOCTR`). `xm[0]`, `xs[0]` are ecliptic longitudes (deg).
3. **UTC↔TT handled automatically & cancels:** `swe_calc_ut` internally forms
   `TT = UT + ΔT(jd_ut)` and evaluates each theory at TT. Because it applies the **same ΔT to
   both modes**, ΔT **cancels exactly** in the difference — so sampling in UTC is correct and
   introduces **no ΔT error**. This answers "maybe we need to convert UTC→TT before sending to
   Moshier": you don't have to; sweph does it identically for both sides. *(If you instead use
   the TT-based `swe_calc`, convert once with `swe_deltat(jd_ut)` and feed the **same** TT to
   both — same result. Do **not** feed UT to one and TT to the other.)*
   - Leap-second nuance: `swe_calc_ut` treats input as UT1≈UTC (differ <0.9 s → Moon moves
     <0.5″); applied to both sides, it cancels. Negligible.
4. **Longitude difference, wrap-safe:**
   `d = ((xm[0] − xs[0] + 180) mod 360) − 180`  (degrees, signed, in [−180,180)),
   `err_arcsec = |d| * 3600`  (store as `float32`).
5. Stream into: threshold counters (§4), running global max (value + i), and local-maxima
   detection (§5).

**Flags summary:** `SEFLG_MOSEPH|SEFLG_NONUT` vs `SEFLG_SWIEPH|SEFLG_NONUT`. NONUT on both
(per instruction) removes the nutation model as a variable; light-time & aberration are
computed identically by both modes and cancel, so leaving them on (default) is fine and
requires no extra flags. `SEFLG_SPEED` not needed.

---

## 4. The threshold histogram ("% of minute-samples over X")

Compute **streaming** (no storage needed):

- Keep an array of counters for a **fixed set of thresholds**. Recommend covering both the
  user's arc-minute asks *and* fine arc-second buckets so the distribution is visible:
  `[1″, 2″, 5″, 10″, 30″, 60″ (=1′), 90″, 120″, 180″ (=3′), 300″ (=5′)]`.
- For each sample, increment every bucket whose threshold it exceeds (or bucket it once and
  form the survival function `P(err > x)` at the end).
- Report as: count and **percentage** of the 78.9 M samples over each threshold, plus a full
  percentile table (p50, p90, p95, p99, p99.9, p100=max) and the histogram/CDF plot.

Because the grid is regular in time, "**% of samples** over X" **equals the fraction of
1950–2100 wall-clock time** the Moon's Moshier error exceeds X — a directly interpretable
"how often is it worse than X" number, which is what the user wants.

*Cost note:* the error curve is smooth over hours, so an **hourly** grid (1.3 M samples) yields
percentages statistically indistinguishable from the per-minute grid at 1/60 the cost. The
per-minute grid is fine and definitive; just know hourly would answer the histogram question
almost identically and near-instantly. (Peak *timing*, however, benefits from the fine grid +
refinement — §5.)

---

## 5. Max error & local-maxima catalogue — "better ways" than brute grid

The user asked whether golden-section / Brent / other methods beat a pure grid. **Yes —
use a hybrid**, because the two questions have different best tools:

- **Histogram / percentages** → inherently a grid statistic (§4). Keep the grid pass.
- **Exact max + local maxima** → *don't* trust the grid to land on the peak. Do:
  1. **Detect candidates** during the grid pass: sample `i` is a local-max candidate if
     `err[i] > err[i−1]` and `err[i] > err[i+1]`. Store only candidates (a few thousand over
     150 yr — the error envelope peaks roughly monthly, so O(1800 months) ≈ a couple thousand).
  2. **Refine each candidate** with **Brent** (`scipy.optimize.minimize_scalar`,
     `method="bounded"` on `−err(t)` within `[t_{i−1}, t_{i+1}]`) or **golden-section**. This
     finds the true continuous peak time (sub-second) and its value, which is ≥ the best grid
     sample. ~2000 candidates × ~15 evals = ~30 k extra evaluations — negligible.
  3. **Global max** = the largest refined local max; report its **UTC timestamp** and value.
- **Enrich the catalogue** with geometry to reveal *why/when* peaks occur: for each local
  maximum record UTC time, err, and lunar **phase** (Sun–Moon elongation), **anomaly**
  (perigee/apogee proximity), **nodal** & **apsidal** phase, distance. This usually shows the
  worst errors clustering at particular alignments (e.g. near syzygy/perigee or evection
  extrema) and lets you predict the envelope rather than just tabulate it.

**Why Brent/golden and not Newton:** the error function has no cheap analytic derivative
(it's a difference of two ephemerides), and it's smooth and unimodal *within a bracket*, so
**derivative-free bracketing methods (Brent, golden-section)** are ideal. Golden-section is
simplest and robust; Brent adds parabolic interpolation for faster convergence — either is
fine on so few candidates.

**Alternative/adjacent methods worth knowing (optional):**
- **Coarse-to-fine only** (skip the full minute grid): if the histogram weren't required, an
  hourly coarse grid + Brent refinement would find all maxima at ~1/60 the cost. Since the
  histogram *is* required, you already have the minute grid, so just reuse it for candidate
  detection.
- **FFT/periodogram** of the error series to identify the dominant beat periods (synodic,
  anomalistic, nodal 18.6 yr, apsidal 8.85 yr) — explanatory, not needed for the numbers.
- **Envelope tracking:** because peaks recur ~monthly, you could evaluate only near predicted
  syzygy/perigee windows — an optimization, not necessary at this compute cost.

---

## 6. Concrete outputs the run should produce

1. `summary.json` / printed table: **global max** (UTC time + arcsec), p50/p90/p95/p99/p99.9,
   and **% of samples over** each threshold (arcsec and arcmin buckets).
2. `maxima.sqlite` (or CSV): **local-maxima catalogue** — `utc, err_arcsec, elongation,
   anomaly, nodal_phase, apsidal_phase, distance_km`, sortable to see the worst N and their
   geometry.
3. Plots: err-vs-time over 1950–2100; CDF / survival `P(err>x)`; err folded on synodic and on
   nodal phase (structure); histogram.
4. `research/README.md`: exact method, flags, sweph/`.se1` versions, how to reproduce.

---

## 7. Pitfalls specific to this run (checklist)

- **UT/TT:** use `swe_calc_ut` for *both* modes (ΔT cancels) — never mix UT and TT across the
  two sides. ✔ handled by §3.
- **Longitude wrap** at 0°/360°: use the `((Δ+180) mod 360)−180` form. ✔
- **`float32` for storage** is plenty (error ~arcsec; float32 ≈ 7 sig figs); use `float64`
  *inside* the diff, downcast only for storage.
- **SWIEPH segment boundaries:** `semo*.se1` has tiny (<<0.01″) discontinuities every 27.55 d —
  can create tiny spurious local-max candidates; ignore sub-0.05″ candidates or smooth before
  peak detection.
- **`.se1` coverage:** `semo_18.se1`/`sepl_18.se1` cover 1800–2399 → fully contain 1950–2100. ✔
- **Don't over-store:** 79 M rows in SQLite (~2.8 GB, slow) is unnecessary; flat array/Parquet
  + DuckDB, or pure streaming, is far better. ✔ (direct answer to the SQLite idea)
- **Thresholds in arcmin may all read ~0 %:** include arcsec buckets so the result is legible.

---

## 8. Direct answers to the user's questions

- *"Times where max error occurs & the max error; local maxima across 1950–2100?"* → §5:
  minute-grid candidate detection + Brent refinement → global max (UTC time + value) and a
  local-maxima catalogue with geometry.
- *"One sample/min, % of samples > 3′, 1′, 0.5′, …?"* → §4: stream per-threshold counters over
  the 78.9 M-minute grid; report count + %; **add arcsec buckets** (expected: ~all under 0.5′).
- *"80 M minutes in SQLite, query as needed — good?"* → §1/§2/§7: workable but **not ideal**;
  the regular grid means the index *is* time, so a **316 MB flat float32 array** (or Parquet +
  DuckDB) beats a ~2.8 GB SQLite table. Use SQLite only for the small maxima/threshold tables.
  Better still: compute the histogram/max **streaming** and store only what you'll re-query.
- *"Golden-section / Brent or better?"* → §5: yes for peak-finding — hybrid (grid histogram +
  Brent-refined candidates). Golden-section/Brent are the right derivative-free choice.
- *"research/ dir + toolchain?"* → §2: C sweep over vendored sweph sources + Python/SciPy/
  DuckDB analysis; layout and reproducibility notes given.

*No code was written or changed this session, per the assignment ("just write plan").* The
next incarnation (or a `v0.4.0` "implement it" assignment) can build `research/moon-moshier/`
directly from §2–§6.

---

## Git state

- Branch `v0.3.1`, based off `v0.3.0`. Contains this report + the committed assignment
  `work-assignment/v0.3.1.txt`. **No source/site changes.** Pushed to `origin/v0.3.1`. No PR
  (process: human monitors via GitHub).
- Ties to `[[session-v0.3.0]]` (the four-plan survey that selected Plan A).
