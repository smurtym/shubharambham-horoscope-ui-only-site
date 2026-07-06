# research/ — offline studies (not part of the shipped site)

Programs here investigate the astronomy engine. They are **not** loaded by the horoscope
site, which stays Moshier-only and data-file-free. These tools may use the full Swiss
Ephemeris `.se1` data files as a gold-standard reference.

## `moon-moshier/` — how accurate is the Moshier Moon over 1950–2100?

Implements Plan A from `ai-work-sessions/session-v0.3.1.md`: measure the Moshier lunar
**ecliptic longitude** error against Swiss Ephemeris **SWIEPH mode** (a 0.001″ compression of
JPL **DE431**), sampled **every minute in UTC** over 1950–2100 (~78.9 M samples).

- Geocentric, **no nutation** (`SEFLG_NONUT`) on both sides; longitude only.
- Both bodies via `swe_calc_ut`, so ΔT (UTC→TT) is applied identically to each mode and
  **cancels** in the difference — sampling in UTC is exact.
- Error per sample = `|wrap180(lon_MOSEPH − lon_SWIEPH)|` in arc-seconds.

### Files

| File | Role |
|------|------|
| `sweep.c` | The C differential sweep. Streams a fine histogram, threshold counters, per-day max, and Brent/golden-refined local maxima. Writes `summary.json`, `daily_max.csv`, `maxima.csv`, `partial.bin`. |
| `Makefile` | Builds `sweep` against the Swiss Ephemeris C sources (`SWEPH_SRC=...`). |
| `fetch-sweph.sh` | Clones the pinned Swiss Ephemeris sources (2.10.03) into `./swisseph`. |
| `merge.py` | Merges `partial.bin` from parallel year-chunks into final `summary.json` + CSVs. |
| `analyze.py` | Prints the report and writes `envelope.svg` (daily-max error over time; no external deps). |
| `../ephe/semo_18.se1`, `sepl_18.se1` | The DE431 reference files (1800–2399), committed so the study is self-contained. |

### Run it

```bash
cd research/moon-moshier
./fetch-sweph.sh                       # clone Swiss Ephemeris sources -> ./swisseph
make SWEPH_SRC=./swisseph              # build ./sweep

# single run (~1 h single-threaded for the full 1/min grid):
mkdir -p out && ./sweep ../ephe 1950 2100 1 out/
python3 analyze.py out                 # report + envelope.svg

# or parallel by year-chunks (4 cores, ~15 min), then merge:
./sweep ../ephe 1950 1988 1 out/c1_ &
./sweep ../ephe 1988 2025 1 out/c2_ &
./sweep ../ephe 2025 2063 1 out/c3_ &
./sweep ../ephe 2063 2100 1 out/c4_ & wait
python3 merge.py out/merged out/c1_ out/c2_ out/c3_ out/c4_
python3 analyze.py out/merged
```

The `sweep` binary, the `swisseph/` clone, and the `out/` results are git-ignored; only the
source, the build scripts, and the `.se1` reference are committed. Findings are written up in
`ai-work-sessions/session-v0.3.2.md`.

### Notes / caveats

- Reference is DE431; Moshier was originally *fit to DE404*, so this measures Moshier vs.
  current-best truth (DE431 ≈ DE440 for the Moon to << 0.01″ over this window), which is the
  number that matters. See `session-v0.3.0.md` §2 for the DE404-vs-DE440 distinction.
- `semo*.se1` has tiny (<< 0.01″) discontinuities every 27.55 d at segment boundaries; the
  local-max detector ignores candidates below 0.05″ so these don't pollute the peak list.
- Histogram bin width is 0.001″ up to 120″ (with overflow); percentiles are read from the
  cumulative histogram (± one bin).
