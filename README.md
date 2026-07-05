# Shubharambham Horoscope — Product, Design, and Implementation Notes

**Site:** https://shubharambham.com/horoscope
**Source code:** https://github.com/smurtym/shubharambham-horoscope-ui-only-site
**License:** AGPL-3.0

This document describes a website that renders a person's Vedic (Jyotish) horoscope from their birth date, time, and place. It is written for three readers: a future version of the author, an AI assistant that picks up the project later, and any other person who ends up maintaining or evaluating it. It records what the product is, why it exists, how it is designed, and how it is built. There is no marketing intent here — only the reasoning and the specifics. The document goes in order: the idea, what it does (features), the design, the implementation, future scope, then the license.

---

## 1. The Idea

### The problem

Most astrology websites today are built to extract, not to inform. The recurring pattern:

- They produce predictions about the user's life — usually rule-based, and increasingly AI-generated.
- They ask for progressively more personal information.
- They gate results behind payment.
- They send spam once an email address is captured.
- The interfaces are cluttered: ads, pop-ups, and poor usability are the norm.

None of that serves an astrologer who simply wants an accurate chart to read.

### What this site is

This site takes a date, time, and place of birth and shows the corresponding Vedic horoscope: the D1 and D9 charts, planetary positions, the key computed values (tithi, nakshatra, signs, lagna), the chara karakas, and the Vimshottari dasha timeline. It performs the astronomical and astrological calculations and presents them cleanly. That is the whole scope.

### Who it is for

It is for astrologers who already know how to read a chart. It assumes the reader understands rasi, nakshatra, pada, lagna, the divisional charts (vargas), karakas, and dashas. It is deliberately not for a general audience looking for life predictions or guidance.

### Non-goals — what it deliberately does not do

- No predictions or interpretations of any kind.
- No accounts, no email capture, no payment, no upsell.
- No advertising, pop-ups, or tracking.
- No data collection or storage of any kind (see [Privacy](#privacy-model-summary)).
- English only for now — localization is deferred (see [Future Scope](#5-future-scope)).

---

## 2. Features (what it computes and shows)

### Inputs

The home-page form collects:

- **Name** — optional. Used only for the page title and on-screen display.
- **Gender** — optional.
- **Birth date** — required.
- **Birth time** — hours and minutes are required; seconds are optional. Birth time drives the ascendant and the house-based calculations.
- **Birth place** — chosen from a place list bundled with the site. The selection resolves to latitude, longitude, and timezone (see [Bundled place dataset](#bundled-place-dataset)).
- **Chart format** — South Indian (default), North Indian, or East Indian. This is carried in the encoded person JSON (see [Person data](#person-data-the-encoded-payload)), so a shared link opens in the format the sender chose.

### Computed values shown

For the given birth data, the site displays:

- Latitude, longitude, and timezone (resolved from the selected birth place).
- Tithi (the tithi only, without the lunar month).
- Nakshatra.
- Sun sign, Vedic (sidereal).
- Sun sign, Western (tropical).
- Moon sign, with pada.
- Lagna (ascendant).

### Charts

- D1 (Rasi) and D9 (Navamsa) are shown, rendered in the chart format carried in the URL (the sender's choice from the form).
- After the chart is rendered, the result page also offers a switch to change between South Indian, North Indian, and East Indian on the fly — this does not change the URL or re-encode the payload; it only changes what is drawn on screen. Reloading or re-sharing the link goes back to the format that was submitted.
- Further divisional charts (D2 through D60) are deferred — see [Future Scope](#5-future-scope).

### Planetary positions

Every planet's position is listed, together with its karaka assignments (Atma Karaka, Amatya Karaka, and the rest of the Jaimini chara karakas).

The per-planet format follows this example:

```
Sun: 0 Ar 38 12'23", Ashwini 1 Pada, Rasi: Ar, Navamsa Rasi: Ar
```

Read as: the planet, its longitude expressed as degree + sign + arcminutes + arcseconds, the nakshatra and pada, the D1 (Rasi) sign, and the D9 (Navamsa) sign.

### Dasha

Vimshottari dasha is shown as an accordion. Each Maha Dasha is a collapsible section; expanding it reveals its Antardasha breakdown. Deeper levels (Pratyantar dasha and below) are deferred — see [Future Scope](#5-future-scope).

### Result-page behaviors

- On submit, the input is serialized to JSON, Base64-encoded, and placed in the URL. The page then renders entirely from that URL.
- The document title is the person's name followed by "'s Horoscope" — for example, "Ramesh's Horoscope". When Name is left blank, the title is simply "Horoscope".
- A **Share** button lets the user hand the page to someone else. Because the full state lives in the URL, sharing the link shares the chart.
- A **Download PDF** button produces the horoscope as a PDF in one click (see [PDF and printing](#pdf-and-printing)).
- A **Print** button prints the page.
- A link back to the **home page** is present on screen but excluded from PDF and print output.

---

## 3. Design

### Principles

- Clean, minimal, and aesthetic; no animations.
- Compatibility over looks. It must work on as many phones and browsers as possible, including older and low-end devices.
- Native HTML and vanilla JavaScript by default; no heavy UI libraries or frameworks that inflate download size. There is one deliberate exception — a third-party PDF library — explained under [PDF and printing](#pdf-and-printing).
- Charts are drawn as SVG.

### Pages

**Home page.** Opens with a short introduction that states plainly that this tool is for astrologers and gives no predictions. It also states the privacy stance: nothing is collected, and everything entered stays on the device. The intro points to the source code — a sentence such as "you can find the source code here," where *here* links to the GitHub repository. Below the intro is the input form.

**Result page.** Reached after submit. It reads the Base64 input from the URL and renders the full horoscope: the computed values, the D1 and D9 charts, the planetary table with karakas, and the dasha accordion. It carries the on-screen "back to home" link (hidden in PDF and print) and the footer.

### Charts (SVG)

The three formats are the standard regional chart layouts:

- **South Indian** — fixed grid with signs in fixed positions. This is the default.
- **North Indian** — diamond layout, with houses fixed and signs rotating.
- **East Indian** — its regional grid form.

Each is rendered as SVG so it scales cleanly on any screen and prints sharply. Both D1 and D9 use the chosen format.

### Output text format

Positions use a compact, astrologer-readable notation — degree, sign abbreviation, arcminutes, arcseconds — as in the per-planet example above. Tithi, nakshatra, both Sun signs, the Moon's pada, and the lagna are presented as labeled values.

### Footer

A footer appears on screen, in the PDF, and in print. It states that the horoscope was generated by shubharambham.com/horoscope and links to https://shubharambham.com/horoscope. Unlike the "back to home" link, the footer is retained in every output form.

### Mobile and compatibility

The layout is responsive and portable by design. Because compatibility is prioritized over visual flourish, the site avoids anything that would fail or degrade on older mobile browsers.

---

## 4. Implementation

### Architecture: everything runs in the browser

There is no backend and no database. All computation and rendering happen client-side. The bulk of the logic is JavaScript; the only C code is a thin glue/wrapper layer around the ephemeris library. Because no server ever receives the birth data, that data cannot be collected or logged server-side.

### Astronomical engine: Swiss Ephemeris via WebAssembly

The Swiss Ephemeris library is compiled to WebAssembly (WASM) and runs in the browser. A small amount of C acts as the wrapper between the JavaScript front-end and the compiled library; everything above that layer is JavaScript.

### Calculation settings

- **Ayanamsa: True Chitrapaksha.** This is hardcoded and cannot be changed from the UI; there is no ayanamsa selector. A user-selectable ayanamsa is deferred — see [Future Scope](#5-future-scope).

### Bundled place dataset

Latitude, longitude, and timezone are not typed in by hand and not fetched from any server. A place dataset is bundled with the site as JSON and shipped to the browser. The birth-place selector picks an entry from it, and that entry's GUID is what gets stored in the person's data. Keeping the dataset local is what lets the site resolve a place to coordinates without a backend and without any network call.

Each entry has this shape:

```json
{
  "id": "random guid",
  "city": "Hyderabad",
  "region": "Telangana, India",
  "lat": 17.385,
  "long": 78.4867,
  "tz": "Asia/Kolkata"
}
```

On the result page, the birth-place GUID from the URL is looked up in this dataset to get the latitude, longitude, and timezone — used both for the calculations and for display.

### Person data: the encoded payload

On submit, the form values are collected into a person JSON, Base64-encoded, and written into the URL. The result page decodes that string and computes everything from it. The URL is the entire state, which is what makes a chart shareable as a plain link and reproducible without any storage.

The person JSON has this shape:

```json
{
  "Name": "",
  "Gender": "",
  "DateTime": "ISO 8601",
  "BirthPlace": "GUID",
  "ChartType": "South Indian"
}
```

- **DateTime** is the birth date and time in ISO 8601. Hours and minutes are required; seconds are optional. The timezone used to convert this to Universal Time comes from the resolved birth place, not from the string itself.
- **BirthPlace** is the GUID of an entry in the bundled place dataset.
- **ChartType** is the chart format chosen on the form — "South Indian", "North Indian", or "East Indian" — and defaults to "South Indian" when not otherwise chosen. This is what the result page renders D1 and D9 in when the link first loads. It is independent of the on-screen style switcher described under [Charts](#charts): the switcher changes only the current view, not this stored value.

### PDF and printing

Two separate actions:

- **PDF** is generated in one click by a third-party, client-side PDF library bundled with the site. This is a deliberate exception to the no-library rule: the browser's native print-to-PDF was rejected because it does not work on some mobile browsers, and a reliable one-click download matters more than avoiding the one dependency. The specific library is still to be chosen. The generated PDF omits the on-screen "back to home" link and keeps the footer.
- **Print** uses the browser's print function with a print stylesheet that hides the on-screen navigation and keeps the footer.

### Deployment: CloudFront

The site is served as static files from CloudFront at shubharambham.com/horoscope. Two configuration points matter:

- **URL query parameters are not logged.** Because the birth data lives in the URL, access logs are configured to record only that the site was accessed, not the parameters.
- **No cookies** are set.

### Privacy model (summary)

Privacy is the reason for most of the architectural choices, so, stated in one place:

- No backend and no database — the data never leaves the device.
- No information is collected from the user. The place dataset is shipped to the browser, so place selection also happens locally with no lookup call.
- No cookies, no tracking.
- Even the deployment's access logs exclude the URL parameters that carry the birth data.

### Open source

The entire product is open source, licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [License](#7-license) for why this specific license was chosen. The repository is at https://github.com/smurtym/shubharambham-horoscope-ui-only-site.

---

## 5. Future Scope

Deferred, and not part of the current build:

- **Divisional charts beyond D1 and D9** — the full D2 through D60 set, likely behind a selector.
- **Deeper dasha levels** — Pratyantar dasha and below, nested under the current Maha → Antar accordion.
- **Localization** — support for languages other than English (the current site is English-only).
- **User-selectable ayanamsa** — a UI control to change the ayanamsa (currently hardcoded to True Chitrapaksha).

---

## 7. License

### What was wanted

The requirement, stated plainly: anyone can use the site, can view and modify the source, can host their own copy — including for commercial purposes — but if they host a modified version, their changes must be made available too. Any derivative work stays open.

### Chosen license: AGPL-3.0

The **GNU Affero General Public License, version 3** matches this requirement point for point:

- **Use, view, modify** — AGPL-3.0 is a standard open-source license; anyone can run, read, and change the code.
- **Commercial use is allowed** — AGPL does not forbid charging money or running a business on the software. It only constrains what happens to the *source*, not whether money changes hands.
- **Hosting counts, not just distributing** — this is AGPL's defining difference from plain GPL. Ordinary GPL only requires source to be shared when the software itself is *distributed* (handed to someone as a copy). A modified GPL program run purely as a web service technically never gets "distributed," so the modifications could stay private forever — the so-called SaaS loophole. AGPL closes exactly that loophole: Section 13 requires that anyone who runs a modified version of the program and lets others interact with it over a network must offer those users the corresponding source, including the modifications. Since this project's entire purpose is a site people host and others reach over the web, this clause is the reason AGPL was picked over GPL.
- **Derivative works stay open** — AGPL is copyleft: any modified or derivative version, however it's used, must itself be distributed under AGPL-3.0 (or a compatible license) with source available. There is no path to taking this code and shipping a closed fork, whether hosted or downloaded.

### Interaction with Swiss Ephemeris's own license

This choice is not independent of the ephemeris engine — it is partly forced by it. Astrodienst distributes Swiss Ephemeris under a dual-license model: developers must pick either **AGPL-3.0** or a paid, per-project **Swiss Ephemeris Professional License** (currently CHF 750 for the first license, CHF 400 for each additional one, purchased directly from Astrodienst). Whichever license a project built on Swiss Ephemeris chooses, that same choice applies to the whole project — there is no way to use Swiss Ephemeris under AGPL terms while keeping the surrounding application closed.

Because this project already wants full copyleft and has no interest in a closed, paid license, taking the **AGPL-3.0** branch of Swiss Ephemeris's own dual license is the natural fit rather than a separate decision: it satisfies Astrodienst's terms for using their library at no cost, and it happens to be exactly the license this project wants for itself anyway. Practically, this also means the AGPL copyleft on this repository is not merely a preference — it is a condition of being allowed to use Swiss Ephemeris for free at all. Astrodienst's own notices are explicit that the copyright notice and author credit must be preserved in any copy, and that Astrodienst's name may not be used to promote a derivative product without written permission; both are ordinary AGPL/attribution obligations and pose no conflict with this project's own AGPL choice.
