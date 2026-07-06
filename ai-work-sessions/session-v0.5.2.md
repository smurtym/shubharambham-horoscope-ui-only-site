# Session log — v0.5.2 (2026-07-06) — date dropdowns, mobile 2-line table, dasha from birth, tropical year

Handoff for the next incarnation. Read `CLAUDE.md`, then earlier `session-*.md`, then this.

Assignment: `work-assignment/v0.5.2.txt` — four items. One WASM rebuild (tropical Sun),
plus form/CSS/dasha changes. Decisions #36–#39.

## What changed (per item)

| Item | Fix | Where |
|------|-----|-------|
| 1. Native date showed mm/dd/yyyy (US-locale browser) | Reverted to **Day/Month/Year dropdowns**; year **1950–2100**; all three **default to today**. | `index.html`, `js/app.js` |
| 2. Mobile table shows unnecessary per-field headings | Compact **two-line card** per planet via CSS grid (line 1: name/pos/nakshatra; line 2: `Rasi:`/`Navamsa:`/karaka). | `css/styles.css`, `js/result.js` (data-labels already present) |
| 3. Antardashas before birth shown | First (balance) maha dasha's pre-birth antardashas dropped; the running one **clamped to start at birth**. | `js/jyotish.js` |
| 4. Dasha year should be 360° **tropical** Sun (per JHora), not sidereal | Shim `se_sun_sid`→**`se_sun_trop`** (tropical); `Astro.sunTropLon`; `TROPICAL_YEAR_DAYS`; WASM rebuilt. | `vendor/sweph/*`, `js/astro.js`, `js/jyotish.js`, `js/result.js` |

Cache-buster bumped to `?v=0.5.2`.

## Notes

- **Date format (do not re-litigate with a native picker):** the native `type="date"` display
  format is locale-bound and cannot be forced — this is exactly why v0.5.1's native picker
  showed mm/dd/yyyy for the user. Dropdowns are the durable answer. (Decisions #38, and see the
  v0.5.1 handoff.)
- **Tropical vs sidereal year (#36):** only the *year-length mapping* changed to tropical; the
  dasha lord and the balance-at-birth still come from the Moon's **sidereal** nakshatra. The
  Sun fast-path shim returns tropical Sun now (`se_sun_trop`), which is simpler than the old
  sidereal one (no ayanamsa step).
- **Item 3 scope:** only the antardasha list of the first MD is trimmed; the MD summary still
  shows its true pre-birth start/end and nominal years (literal reading of the request). If a
  future ask wants the MD itself to start at birth with a balance-years label, change the
  summary too.

## Verification

- `node --check` on every `js/*.js` — pass.
- **`se_sun_trop`** is bit-identical to the full-compute tropical Sun at J2000 (diff 0.0).
- **Headless dasha test** (1990-05-15 08:30 IST): tropical year, total span **120.000 yr**,
  antardashas monotonic; **MD0's first antardasha (Sun/Mars) starts exactly at birth**
  (15 May 1990) and none end before birth — items 3 & 4 confirmed.
- **Playwright E2E, desktop:** date dropdowns **default to today** (6/7/2026), year range
  2100→1950; combobox still works; result page's MD0 first antardasha row reads
  "Mars 15 May 1990 – 20 Jul 1990". Zero console errors.
- **Playwright E2E, mobile (390px):** planet rows are CSS `grid` two-line cards, the
  `Rasi:`/`Navamsa:` labels render, and there is **no table or body horizontal overflow**.
  Screenshot eyeballed: matches the requested `Moon Mo … / Rasi: … Navamsa: … <karaka>` layout.

## Git state

- Branch `v0.5.2`, off `v0.5.1`. Commits: assignment text; the changes + rebuilt WASM; docs
  (Decisions #36–#39, sweph README) + this handoff. Pushed to `origin/v0.5.2`. No PR.
- `main` untouched.

## Notes for next time

- **Bump `?v=` every release** (standing fix for stale-cache reports; Decisions #23).
- Year dropdown range is 1950–2100 (`populateDate` in `js/app.js`).
- If the mobile two-line grid ever overflows on a very narrow device, the nakshatra/karaka
  (grid col 3) are allowed to wrap; tighten `font-size` in the `@media (max-width:560px)` block.
