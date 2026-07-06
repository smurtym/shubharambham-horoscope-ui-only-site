# Swiss Ephemeris — WebAssembly build

This directory holds the real [Swiss Ephemeris](https://www.astro.com/swisseph/) astronomy
engine, compiled to WebAssembly, that powers `js/astro.js` as of **v0.2.0**. It replaces the
pure-JavaScript approximation used in v0.1.0.

## Files

| File | What it is |
|------|-----------|
| `sweph.js` | The build artifact loaded by the site. A single self-contained Emscripten module with the WASM binary inlined as base64 (`SINGLE_FILE=1`). Defines the global factory `SwephModule`. |
| `se_shim.c` | The thin C entry point we wrote (`se_compute`) that wraps the Swiss Ephemeris calls the app needs into one function filling a flat `double` array. |
| `build.sh` | Reproduces `sweph.js` from the official sources + `se_shim.c`. |
| `LICENSE.swisseph` | Swiss Ephemeris licence (AGPL-3.0 option — matches this project). |

## How it was built

- **Source:** official mirror `github.com/aloistr/swisseph`, Swiss Ephemeris **2.10.03**.
- **Toolchain:** Emscripten **4.0.13** (`emcc`).
- **Mode:** Moshier (`SEFLG_MOSEPH`) — Swiss Ephemeris's built-in analytical theory, which
  needs **no `.se1` data files**. Essential for a static, offline, `file://` site. Accuracy
  is far better than the v0.1.0 JS engine (sub-arcsecond for planets over several millennia;
  the Moon within ~0.1′), though slightly below the full JPL-data ephemeris.
- **Ayanamsa:** True Chitrapaksha (`SE_SIDM_TRUE_CITRA`), matching the v0.1.0 decision.
- **Rahu:** **true** lunar node (`SE_TRUE_NODE`) as of **v0.4.0** (was the mean node in
  v0.2.0). Ketu is derived in JS as the opposite point.
- **Speeds:** as of v0.4.0 the shim also returns each body's ecliptic-longitude speed
  (`out[13..22]`), so `js/astro.js` can flag retrograde grahas (negative speed).
- **No ephemeris path needed:** in Moshier mode there are no `.se1` files, so
  `swe_set_ephe_path` is not called (it only matters for `SEFLG_SWIEPH`/`SEFLG_JPLEPH`).

- **Sun-only fast path:** as of v0.4.1 the shim also exports `se_sun_sid(tjd_ut)` returning
  the Sun's sidereal longitude only, used by the precise Vimshottari dasha to avoid a full
  `se_compute` per root-finding step.

To rebuild, see the header of `build.sh`. `se_compute` fills **23** doubles (was 13);
`se_sun_sid` fills **1**.

## Licence note

Swiss Ephemeris is dual-licensed (AGPL-3.0 or a commercial licence). This project is
AGPL-3.0, so the AGPL option applies. Keep `LICENSE.swisseph` alongside the artifact.
