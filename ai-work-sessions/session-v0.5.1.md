# Session log — v0.5.1 (2026-07-06) — combobox, native date picker, chart markers

Handoff for the next incarnation. Read `CLAUDE.md`, then the earlier `session-*.md`, then this.

Assignment: `work-assignment/v0.5.1.txt` — three reported problems (two of them reversing
earlier decisions). No engine/WASM change; form + CSS + chart-layout. Decisions #33–#35.

## What changed (per item)

| Item | Fix | Where |
|------|-----|-------|
| Place search broken (datalist unusable on desktop; keyboard-suggestions on iPhone) | Replaced the native `<datalist>` with a small **vanilla-JS combobox** (filtered `<ul>` listbox; mouse + ↑/↓/Enter/Esc). | `index.html`, `js/app.js`, `css/styles.css` |
| Want an actual date **selector**, dd/mm/yyyy, dates **1950–2100**, open at **today** | Native `<input type="date">` (calendar/wheel), `min=1950-01-01 max=2100-12-31`, defaults to today. Replaces the v0.4.2 Day/Month/Year dropdowns. | `index.html`, `js/app.js` |
| North/East **house markers in the middle** crowd the planets (South is good) | Markers moved to each house's **outer corner** via new `NORTH_MARK`/`EAST_MARK` tables + a centred `.hmark` style; planets keep the centre. | `js/charts.js` |

Cache-buster bumped to `?v=0.5.1`.

## Important note on the date format (read before "fixing" it again)

The user has asked for **dd/mm/yyyy** across several rounds. A native `<input type="date">`
**cannot** have its display format forced — it follows the **browser/OS locale**. For the
user (India) it shows dd/mm/yyyy, which is the goal; `lang="en-GB"` nudges browsers that
honour it. A US-locale browser would show mm/dd/yyyy. The only way to *guarantee* dd/mm/yyyy
**and** keep a calendar picker is a fully custom date widget (a calendar popup in vanilla JS)
— deliberately not built, since the user explicitly wanted the native selector. If they
report the wrong format again, the answer is either "set your browser locale" or "build a
custom picker" — not another native-input tweak. (Decisions #34.)

## The combobox (item 1)

`#place` is a text input; `js/app.js` `setupPlaceCombo()` builds a sorted `[{id,label}]`,
filters on input (substring, case-insensitive), renders a `<ul#place-results>` listbox, and
tracks a highlighted option for keyboard use. Selecting sets `selectedPlaceId`; `onSubmit`
uses `resolvePlaceId()` (explicit selection, else an exact label match) and errors if unset.
Uses `mousedown` (not `click`) so a pick fires before the input's blur closes the list.

## Chart markers (item 4)

`renderNorth`/`renderEast` now read the marker anchor from `NORTH_MARK`/`EAST_MARK` (corner
of each house) instead of offsetting from the planet anchor. The marker uses `.hmark`
(centre-anchored, 10px) so short labels sit cleanly in the corner. Positions were tuned
against a multi-planet chart; if any marker ever looks cramped, adjust only these two tables.

## Verification

- `node --check` on every `js/*.js` — pass.
- **Playwright E2E from `file://`:** `#date` is `type=date`, value defaults to today,
  `min=1950-01-01`/`max=2100-12-31`. Combobox: typing "hyd" filters to "Hyderabad —
  Telangana, India"; clicking it fills the input, hides the list, and the result page shows
  Hyderabad. Zero console/page errors.
- **Screenshots** (North, East, South — D1 & D9) eyeballed: North rasi markers and East house
  numbers now sit in the house corners with the planets centred and uncrowded; "As" is still
  red; South unchanged (house numbers top-left). House 1 correctly marks the lagna cell in all
  three formats.

## Git state

- Branch `v0.5.1`, off `v0.5.0`. Commits: assignment text; the changes; docs (Decisions
  #33–#35) + this handoff. Pushed to `origin/v0.5.1`. No PR (human monitors via GitHub).
- `main` untouched.

## Notes for next time

- **Bump `?v=` every release** (standing fix for stale-cache reports; Decisions #23).
- Date format is locale-bound — see the note above before changing it.
- Combobox filters on the "City — Region" label; extend `setupPlaceCombo` if fuzzier matching
  is ever wanted. Year range for the date is 1950–2100 (the `min`/`max` on the input).
