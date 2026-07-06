# Session log — v0.3.0 (2026-07-06) — RESEARCH ONLY, no code changes

Assignment: `work-assignment/v0.3.0.txt`. A **research story, not a change**. The concern:
how accurate is the **Moshier ephemeris for the Moon over 1950–2100**? Our v0.2.0
`vendor/sweph/README.md` claims "the Moon within ~0.1′" and the user is not convinced —
"I feel that is more than that." The task is **not** to implement anything, but to produce
the **best plan(s) to measure the min and max accuracy of Moshier's Moon**, with a detailed
report. Multiple plans wanted, compared.

No human was available to answer questions (per `CLAUDE.md` process). This document is the
deliverable.

---

## 0. TL;DR

- "Accuracy" here means: **angular deviation of the Moshier Moon from a trusted reference
  ephemeris**, sampled densely across 1950–2100, reduced to a min/max/RMS envelope.
- **Published claims already disagree**, which alone justifies measuring:
  - Swiss Ephemeris core doc: the Moshier Moon uses "a modified version of the lunar theory
    of Chapront-Touzé and Chapront … precision of **0.5 arc second relative to DE404** for
    all dates between 1369 B.C. and 3000 A.D."
  - Swiss Ephemeris summary/marketing page: "a few arc seconds with the Moon" / **"around
    3 arcseconds."**
  - Neither figure is stated **specifically for 1950–2100**, and both are **relative to
    DE404** (a 1996-era JPL ephemeris), not the current best truth (DE440/DE441). Our
    README's "~0.1′" = 6″ is a conservative upper bound consistent with both, but unverified.
- **Recommended measurement:** a fast **same-library differential sweep** (Moshier vs. the
  Swiss `.se1`/DE431 mode, `Plan A`) over the whole window at ≤6 h cadence with local
  refinement of maxima, **cross-validated** at a subset of epochs against an **independent
  gold standard** (JPL DE440 via SPICE or Horizons, `Plan B`) to prove the result isn't an
  artifact of shared Swiss-Ephemeris code. `Plan C` (vs. full ELP/MPP02) and `Plan D`
  (literature bound) are supporting cross-checks.
- **Expected outcome** (hypothesis to be confirmed, not an answer): a max geocentric total
  angular error in the low single-digit **arc-seconds** (order 0.5–4″), i.e. **well under
  0.1′**, oscillating with the lunar months and the 18.6-yr nodal / 8.85-yr apsidal cycles.
  Even a pessimistic 10× that is still ~4 orders of magnitude below a nakshatra-pada
  boundary (200′), so it is astrologically irrelevant — but the point of this task is the
  measured number, not the sufficiency argument.

---

## 1. First, pin down what "accuracy of Moshier for the Moon" means

Before any measurement, six definitional choices must be fixed, or you will "measure" the
wrong thing (mismatched conventions dwarf the actual Moshier error):

1. **Reference = truth.** Moshier's error is *by definition* its deviation from a reference.
   Choose the reference deliberately (Section 3). Note the built-in ambiguity: Moshier was
   *fit to DE404*, so "error vs. DE404" (theory truncation only) ≠ "error vs. DE440/441"
   (truncation **plus** the DE404→DE440 model revision). Report **both**; the app cares about
   the second (deviation from current best truth), but the first isolates the theory.

2. **Which angle.** Report at least two:
   - **Total angular separation** of the two geocentric unit vectors (the honest "how far
     off is the Moon" number).
   - **Ecliptic longitude-only** error — this is what actually moves a body across
     sign / nakshatra / pada boundaries in *this* app (the horoscope is sidereal-longitude
     driven). Latitude error matters for eclipses, not for nakshatra.

3. **Geocentric vs. topocentric.** The app computes the **geocentric** Moon (`swe_calc_ut`
   with no `SEFLG_TOPOCTR`). Measure geocentric. (Moshier's intrinsic error is independent
   of the parallax step, which is applied afterward from the same Earth–Moon geometry, so
   topocentric would just add a common ~1° parallax term to both sides and cancel.)

4. **Apparent vs. astrometric / frame.** "Apparent position of date" applies light-time,
   aberration, precession and nutation; "astrometric J2000" applies none of the last two and
   not aberration. The two references must be asked for the **exact same** quantity as
   Moshier or the convention mismatch (tens of arcsec for aberration, arcmin for nutation)
   swamps the signal. Cleanest: compare in a frame where these terms are either identical on
   both sides or turned off on both sides.

5. **Time argument & ΔT.** Moshier is a function of **TT** (ephemeris time). Compare using
   the **TT-based** call (`swe_calc`, not `swe_calc_ut`) on both sides so that ΔT
   (TT−UT) — which is a *timescale* uncertainty, not an ephemeris error — **drops out
   entirely**. Feeding UT to one side and TT to the other would inject a spurious ~0.3″/s ·
   ΔT error (ΔT ≈ 60–70 s over 1950–2100 → the Moon moves ~30–35″ in that time; that would
   completely dominate and mislead).

6. **min / max defined.** "Min accuracy" and "max accuracy" are ambiguous; report the full
   error **envelope** over 1950–2100:
   - **min |error|** (best case; the error curve crosses ~0 many times),
   - **max |error|** (worst case — the number the user actually wants as the guarantee),
   - **mean, RMS, median, 95th/99th percentile**,
   - and **when/where** the max occurs (date, lunar phase, nodal/apsidal phase), because the
     worst case clusters at particular geometric alignments.

---

## 2. Published claims (context / expected bound — not a measurement)

| Source | Statement about the Moshier Moon |
|--------|----------------------------------|
| Swiss Ephemeris core doc (`swisseph.htm`) | "modified version of the lunar theory of Chapront-Touzé and Chapront … **0.5 arc second relative to DE404**, 1369 B.C.–3000 A.D." |
| Swiss Ephemeris summary page | Moshier deviation "**a few arc seconds** with the Moon" / "**around 3 arcseconds**"; advantage = no data files, disadvantage = limited Moon precision |
| Swiss Ephemeris doc (basis) | Moshier = "a **semi-analytical approximation of the JPL … DE404**"; covers **3000 BCE – 3000 CE** |
| Swiss Ephemeris doc (SWIEPH) | The `.se1` files are a compression of **DE431** agreeing with JPL to **1 milli-arcsecond (0.001″)** |
| Swiss Ephemeris doc (SWIEPH lunar) | Compressed lunar files (`semo*.se1`) introduce small **discontinuities every 27.55 days** at segment boundaries (small, but a known reference artifact) |

Takeaways for the plan: (a) the published Moon figure spans **0.5″ to ~3″** — a 6× spread —
so measuring is genuinely informative; (b) both figures are **relative to DE404**; (c) the
SWIEPH mode is an almost-perfect (0.001″) local proxy for JPL DE431, which makes it an
excellent, convenient reference (Plan A) — but because it shares Swiss Ephemeris's own
light-time/aberration/nutation code with Moshier mode, it cannot catch a bug in that shared
code; hence the independent cross-check (Plan B).

---

## 3. The reference-ephemeris ("ground truth") landscape

Ordered by authority for the Moon over 1950–2100:

1. **JPL DE440 / DE441** — current best planetary+lunar ephemeris, fit to Lunar Laser
   Ranging; the Moon is good to **centimetres / sub-milliarcsecond**. This is *the* truth.
   Access:
   - **SPICE toolkit + `de440.bsp`** (via `spiceypy` in Python) — fully local, scriptable to
     millions of epochs, no rate limit, total control of the position definition. **Best for
     bulk.**
   - **JPL Horizons** (web API) — authoritative apparent/astrometric geocentric positions,
     but rate-limited and awkward for millions of points; ideal for **spot-check validation**.
2. **Swiss Ephemeris SWIEPH mode** (`SEFLG_SWIEPH`, needs `semo_18.se1` + `sepl_18.se1`,
   ~1.3 MB each, covering **1800–2399**) — a 0.001″ compression of **DE431**. For the Moon
   over 1950–2100, DE431 ≈ DE440 to well under 0.01″. **Best for the bulk sweep** because it
   is the *same library* as Moshier: identical frame, nutation, aberration, light-time — so
   the difference is **purely the ephemeris model**, nothing else. Free from the Astrodienst
   FTP (`astro.com/ftp/swisseph/ephe`).
3. **DE404** — the ephemeris Moshier was *fit to*. Only interesting to reproduce the "0.5″"
   claim and to separate truncation error from the DE404→DE440 revision.
4. **Full ELP2000-82B / ELP/MPP02** (Chapront) — the *complete* lunar theory of which Moshier
   ships a **truncated** version. Comparing Moshier to full ELP isolates the **truncation**
   error specifically (same theory family). IMCCE publishes ELP/MPP02 series + code.
5. **INPOP** (IMCCE, France) — a JPL-independent modern numerical ephemeris; a good *second*
   gold standard to confirm a JPL-vs-Moshier result is not biased by JPL-specific choices.

---

## 4. The plans

### Plan A — Same-library differential sweep (Moshier vs. SWIEPH/DE431) — **primary**

**Idea.** In one Swiss Ephemeris process, call the Moon twice per epoch: once with
`SEFLG_MOSEPH`, once with `SEFLG_SWIEPH` (all other `iflag` bits identical). Difference =
Moshier's model error relative to DE431, with every other convention cancelling exactly.

**Method.**
- Tooling: **`pyswisseph`** (Python) or a small C/Node harness using the sources we already
  have in `vendor/sweph/`. Download `semo_18.se1` + `sepl_18.se1`, `swe_set_ephe_path` to
  them. (This is *offline research tooling, separate from the shipped site* — the site stays
  Moshier-only and data-file-free.)
- Use the **TT-based** `swe_calc(jd_tt, SE_MOON, iflag)` on both sides (ΔT cancels, §1.5).
- `iflag` for both: same set — e.g. plain apparent (no extra flags) or add `SEFLG_J2000 |
  SEFLG_NONUT` on both to strip nutation/precession from *both* (recommended: it makes the
  comparison purely geometric and removes the nutation model as a variable). `SEFLG_SPEED`
  optional.
- **Sampling:** the Moon moves ~0.55°/h and its error curve beats at the synodic (29.53 d),
  anomalistic (27.55 d), draconic (27.21 d), nodal (18.6 yr) and apsidal (8.85 yr) periods.
  To catch the true worst case you must sample **finely** and **span the long cycles**:
  - Bulk grid: **every 6 h** over 1950–2100 ≈ **219,000 samples** (trivial compute, seconds).
    Every 1 h (~1.3 M samples) if being thorough; still cheap.
  - **Refinement:** around each local maximum of |error|, run a **golden-section / Brent**
    local maximization on the continuous `jd` to pin the true peak (the grid can miss a sharp
    peak by up to half a step).
- **Metrics** (per §1): total angular separation (via dot product of unit vectors) **and**
  ecliptic-longitude-only error; then min, max, mean, RMS, median, p95, p99 over the window,
  plus the timestamp + lunar/nodal/apsidal phase of the max. Emit a CSV + plots (error vs.
  time; error folded on synodic and nodal phase).

**Pros:** trivial cost (whole sweep in seconds–minutes); *perfectly* controlled (only the
ephemeris model differs); uses code we already built; DE431 ref is 0.001″-faithful to JPL.
**Cons / caveats:** (a) shares Swiss Ephemeris's light-time/aberration/nutation code with
Moshier, so a bug there would cancel and hide (→ Plan B guards this); (b) the reference is
DE431, so this yields Moshier-vs-DE431, ≈ vs current truth but **not** vs the DE404 Moshier
was fit to; (c) the `semo*.se1` 27.55-day boundary discontinuities add a tiny (<< 0.01″)
saw-tooth to the reference — negligible but worth noting.

### Plan B — Independent gold standard (JPL DE440 via SPICE, and/or Horizons) — **validation**

**Idea.** Compare Moshier against a source that shares **no code** with Swiss Ephemeris, to
prove Plan A's number is real and not a shared-code artifact, and to measure vs. **current
truth (DE440)** rather than DE431.

**Method.**
- **B1 — SPICE / `spiceypy` + `de440.bsp`** (local, bulk-capable). For each epoch compute the
  geocentric Moon state from DE440; apply the **same** definition Moshier returns (geometric
  vs. apparent: either compare Moshier's *astrometric* output to SPICE geometric+light-time,
  or add aberration to match — decide once per §1.4). Convert both to ecliptic-of-date or a
  common J2000 ecliptic. Difference = Moshier vs. DE440. Can run the full 1950–2100 grid too,
  making B a full independent replication of A, not just spot checks.
- **B2 — JPL Horizons API** (authoritative, rate-limited). Query the Moon's geocentric
  apparent ecliptic lon/lat at a few thousand epochs — **including the exact timestamps of
  Plan A's maxima** — and compare. Best used to *confirm* the peaks A/B1 find, cheaply and
  from the definitive public service.

**Pros:** independent of Swiss Ephemeris; measures vs. the true best ephemeris; Horizons is
unimpeachable for spot checks. **Cons:** must **exactly** match position conventions
(light-time, aberration, frame, nutation model, ecliptic definition) between two different
toolchains — this convention-matching is the single largest methodological risk and the main
labor. Horizons rate limits preclude a full dense sweep.

### Plan C — Truncation-only: Moshier vs. full ELP2000/MPP02 — **supporting**

**Idea.** Moshier ships a *truncated* Chapront theory. Compare it to the **full** ELP2000-82B
or ELP/MPP02 series (IMCCE) evaluated at the same TT. The difference is almost purely the
**truncation** error (dropped periodic terms), separated from the DE-revision effects.

**Pros:** attributes the error budget (truncation vs. theory-vs-reality); no
frame/aberration confounders if done in the theory's own geometric ecliptic. **Cons:** need a
correct full-ELP implementation (existing C/Python ports exist but must be validated);
answers "how much did truncation cost," which is related to but not identical to "error vs.
truth."

### Plan D — Literature / documentation bound — **cheap sanity check**

**Idea.** Not a measurement: collect the authoritative claimed bounds (Section 2), Moshier's
own notes (`swemmoon.c` header + Steve Moshier's `aa`/`moshier` documentation), and the
Chapront ELP papers, to derive an **expected envelope** (≈0.5–3″ vs. DE404). Use it to
sanity-check the empirical result: if Plan A returns 0.4″ or 300″, something is wrong with
the harness (convention bug), not with Moshier.

---

## 5. Comparison of the plans

| | A: MOSEPH vs SWIEPH | B: vs JPL DE440 (SPICE/Horizons) | C: vs full ELP | D: literature |
|---|---|---|---|---|
| Reference authority | DE431 (0.001″ of JPL) | **DE440 (truth)** | theory family | published claims |
| Independent of sweph code | ✗ (shared) | ✓ | ✓ (mostly) | ✓ |
| Bulk / full-window feasible | ✓✓ (seconds) | B1 ✓ / B2 ✗ | ✓ | n/a |
| Convention-matching risk | **none** (cancels) | **high** | low–med | n/a |
| Effort | low | med–high | med | very low |
| Isolates truncation vs revision | partial | ✗ (total) | ✓ (truncation) | ✗ |
| Primary role | **bulk envelope** | **independent validation + vs truth** | error attribution | expected bound |

---

## 6. Recommended plan (a combination)

1. **D first** (½ hour): lock the expected bound (≈0.5–3″ vs DE404) so the harness can be
   sanity-checked.
2. **A as the workhorse** (½–1 day): full 1950–2100 sweep at 6 h (then 1 h) cadence,
   TT-based, identical `iflag` (recommend `SEFLG_J2000|SEFLG_NONUT` on both to make it purely
   geometric), total-angle **and** longitude-only, with golden-section refinement of maxima.
   Produces the min/max/RMS/percentile envelope + CSV + plots. This is the number the user
   asked for, relative to DE431.
3. **B1 to validate** (1–2 days, the convention-matching is the cost): replicate at a dense
   subset (and ideally the full grid) against **DE440 via SPICE**, matching conventions
   carefully. Agreement with A confirms no shared-code artifact and upgrades the reference to
   *current truth*; **B2/Horizons** spot-checks the exact Plan-A peak timestamps.
4. **C optional** (if the error attribution matters): Moshier vs. full ELP/MPP02 to split
   truncation from theory-revision.

**Why this combination:** A gives a complete, cheap, perfectly-controlled envelope; B guards
against the one blind spot of A (shared code) and measures against the true ephemeris; D
bounds the sanity of both; C explains *why* the number is what it is. Any single plan alone
has a gap that the others close.

---

## 7. Pitfalls that would corrupt the measurement (checklist)

- **Timescale mismatch (biggest trap):** UT vs TT on the two sides → injects up to ~30–35″
  of spurious Moon error. Use TT on both; if using `_ut` calls, use the *same* ΔT for both.
- **Convention mismatch (Plan B):** apparent vs astrometric, aberration on/off, of-date vs
  J2000 ecliptic, nutation model (IAU1980 vs IAU2000) → tens of arcsec. Match exactly.
- **Geocentric vs topocentric:** mixing them → up to ~1° (parallax). Keep both geocentric.
- **Under-sampling / too-short a span:** a coarse grid or a window shorter than 18.6 yr can
  miss the worst-case nodal/apsidal alignment → under-reports max. Sample ≤6 h and span the
  full 1950–2100 (covers ~8 nodal and ~17 apsidal cycles); refine peaks locally.
- **Longitude wrap / branch cuts:** difference longitudes as `((Δ+180) mod 360)−180`; prefer
  the 3-D unit-vector dot product for the total angle to avoid pole/wrap issues.
- **Reference artifacts:** `semo*.se1` 27.55-day boundary saw-tooth (<<0.01″) — negligible but
  don't mistake it for signal; DE431 vs DE440 for the Moon over this window (<0.01″).
- **"vs DE404 vs DE440" conflation:** state which reference each number is against; don't
  compare a DE404-relative published 0.5″ to a DE440-relative measured value as if equal.

---

## 8. Expected result & how to present it (hypothesis, to be confirmed)

- A **max total angular error** in the low single-digit arcsec (order **0.5–4″**), a **max
  longitude error** of similar magnitude, **RMS ~0.3–1.5″**, with the worst case landing near
  particular nodal/apsidal + syzygy alignments. Present as: (i) headline min/max/RMS/p99 table
  for total-angle and longitude; (ii) error-vs-time plot 1950–2100; (iii) error folded on
  synodic and nodal phase to show the structure; (iv) the date/geometry of the max.
- **Interpretation for this project:** even a pessimistic upper bound (say 10–20″) is
  ~0.003–0.005° — versus a **nakshatra pada of 3°20′ (200′)** and a **nakshatra of 13°20′**.
  So Moshier's Moon error is **~4 orders of magnitude below a pada boundary**; it can only
  matter in the astronomically pathological case of a birth Moon sitting within a few arcsec
  of a pada cusp. The v0.2.0 README's "~0.1′ (6″)" is therefore a **conservative** statement,
  not an optimistic one — the published theory figure (0.5″ vs DE404) is *better*. The user's
  intuition that "it's more than that" is worth testing empirically (Plan A), but the likely
  finding is that Moshier is at least as good as advertised for 1950–2100 and comfortably
  sufficient here. **No code change is implied by this task and none was made.**

---

## 9. Concrete deliverables for whoever *implements* the measurement later

1. A standalone research script (Python + `pyswisseph`, or a Node/C harness over
   `vendor/sweph/` sources) — kept out of the shipped site — that:
   downloads `semo_18.se1`/`sepl_18.se1`; runs the Plan A sweep; emits `moon_moshier_error.csv`
   (jd_tt, date, Δlon_arcsec, Δtotal_arcsec, lunar_phase, nodal_phase) and summary stats + plots.
2. A Plan B validator (SPICE/`de440.bsp` and/or a Horizons batch) over Plan A's peak epochs.
3. A short results note appended here (or `docs/moshier-accuracy.md`) with the min/max/RMS
   table and the plots — and, only if the measured max were to exceed the README's 0.1′
   claim, a follow-up assignment to revise `vendor/sweph/README.md`.

---

## Git state

- Branch `v0.3.0`, based off `v0.2.0`. Contains: this report, the committed assignment
  `work-assignment/v0.3.0.txt`, and a `CLAUDE.md` tweak (commit each session's assignment
  text going forward). **No source/site changes** — this was a research task by instruction.
- Pushed to `origin/v0.3.0`. No PR opened (process: human monitors via GitHub).

## Sources

- Swiss Ephemeris documentation — https://www.astro.com/swisseph/swisseph.htm
- Swiss Ephemeris "for 8000 years and more" (accuracy summary) —
  https://www.astro.com/swisseph/swephinfo_e.htm
- Swiss Ephemeris ephemeris-file index (which `.se1` covers which years) —
  https://www.astrolog.org/ftp/ephem/se_index.txt
- pyswisseph docs (three ephemerides: JPL / Swiss / Moshier) —
  https://github.com/astrorigin/pyswisseph
