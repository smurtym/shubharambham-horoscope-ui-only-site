# CLAUDE.md — working agreement for this repo

This file tells every future AI incarnation how work is run on **Shubharambham
Horoscope**. Read it first, every session, before touching anything.

## What this project is

A static, fully client-side Vedic (Jyotish) horoscope calculator. No backend, no build
step required to run — open `index.html` in a browser and it works from `file://`. See
`README.md` for the product and `ai-work-sessions/` for build history.

## The work process (how sessions are run)

Work is assigned asynchronously through **text files in the `work-assignment/` folder**.
The human will not answer questions mid-session. When told to "start" (in whatever words),
follow this loop:

1. **Orient.**
   - Read every file in `ai-work-sessions/` to learn what previous incarnations did, why
     the code is shaped the way it is, and what was deliberately deferred.
   - Read every file in `work-assignment/` to learn what is still to be done. The newest
     file (by version, e.g. `v0.2.0.txt`) is usually this session's assignment.
2. **Branch.** Create a new git branch for the session, named after the assignment file
   (e.g. assignment `v0.2.0.txt` → branch `v0.2.0`). Base it on the previous version's
   branch (the latest work), not necessarily `main`.
3. **Decide autonomously.** No human is available. When a choice comes up, take the best
   decision you can for that moment and **record it in `Decisions.md`** (numbered, with the
   reasoning and any accuracy/scope trade-off) so it can be reviewed later. Never block
   waiting for an answer.
4. **Work in small steps with frequent commits.** Commit early and often and **push to
   `origin`** so progress is visible on GitHub throughout the session, not just at the end.
5. **Verify.** Exercise the change end-to-end (headless calc checks + a browser E2E pass)
   before declaring it done. Keep verification artifacts in the scratchpad, not the repo.
6. **Hand off.** When the work is done, write a session summary to
   `ai-work-sessions/session-<version>.md` describing what was built, why, how it was
   verified, the git state, and what remains deferred — so the next incarnation can orient
   from it. Do a final commit and push.

## Conventions worth keeping

- **Astronomy is isolated behind `Astro.*`** (`js/astro.js`). Anything that needs planetary
  positions goes through `Astro.compute(...)`; keep that boundary so the engine can be
  swapped without touching the Jyotish/render layers.
- **No network at runtime.** No `fetch`; ship data as JS (see `js/places.js`). Everything
  must work offline / from `file://`.
- Vanilla JS, global module objects (`Astro`, `Jyotish`, `Charts`, `Common`, `PDF`,
  `PLACES`), no framework, no bundler.
- Sanity-check every `js/*.js` with `node --check` before committing.
- Licence is AGPL-3.0; keep third-party code's licences intact in `vendor/`.

## Layout

- `index.html`, `result.html` — the two pages.
- `js/` — app logic (see `ai-work-sessions/session-v0.1.0.md` for the per-file map).
- `vendor/` — bundled third-party code (jsPDF; Swiss Ephemeris WASM as of v0.2.0).
- `Decisions.md` — the running decision log. Append; don't rewrite history.
- `work-assignment/` — inbound tasks (human → AI).
- `ai-work-sessions/` — outbound handoffs (AI → next AI). One file per version.
