/*
 * jyotish.js — the Vedic (Jyotish) astrology layer.
 *
 * Part of Shubharambham Horoscope (AGPL-3.0). See README.md and Decisions.md.
 *
 * Consumes tropical positions from Astro.compute() and produces the sidereal quantities an
 * astrologer reads: signs (rasi), nakshatra & pada, navamsa (D9), tithi, the Jaimini chara
 * karakas, and the Vimshottari dasha timeline. Depends on the global `Astro`.
 */
(function (global) {
  "use strict";

  var norm360 = global.Astro.norm360;

  // Sign abbreviations and names (0 = Aries).
  var SIGN_ABBR = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"];
  var SIGN_NAME = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra",
    "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

  // 27 nakshatras (0 = Ashwini). Lord cycle drives Vimshottari.
  var NAKSHATRA = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
    "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];

  // Tithi names within a paksha (1..15).
  var TITHI_NAME = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi",
    "Chaturdashi"];

  // Display order and abbreviations of the nine grahas.
  var GRAHA_ORDER = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
    "Rahu", "Ketu"];
  var GRAHA_ABBR = {
    Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju",
    Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke"
  };

  var NAK_LEN = 360 / 27;      // 13°20'
  var PADA_LEN = NAK_LEN / 4;  // 3°20'

  // Decompose a sidereal longitude into astrologer-readable parts.
  function decompose(lon) {
    lon = norm360(lon);
    var sign = Math.floor(lon / 30);
    var inSign = lon - sign * 30;
    var deg = Math.floor(inSign);
    var minFloat = (inSign - deg) * 60;
    var min = Math.floor(minFloat);
    var sec = Math.round((minFloat - min) * 60);
    if (sec === 60) { sec = 0; min += 1; }
    if (min === 60) { min = 0; deg += 1; }
    var nakIndex = Math.floor(lon / NAK_LEN);
    var pada = Math.floor((lon - nakIndex * NAK_LEN) / PADA_LEN) + 1;
    // Navamsa (D9): continuous 3°20' divisions from Aries 0°.
    var navamsaSign = Math.floor(lon / PADA_LEN) % 12;
    return {
      lon: lon,
      sign: sign,
      signAbbr: SIGN_ABBR[sign],
      signName: SIGN_NAME[sign],
      deg: deg, min: min, sec: sec,
      inSign: inSign,
      nakIndex: nakIndex,
      nakshatra: NAKSHATRA[nakIndex],
      pada: pada,
      navamsaSign: navamsaSign,
      navamsaAbbr: SIGN_ABBR[navamsaSign]
    };
  }

  // Convert tropical Astro output to sidereal and decompose every graha + ascendant.
  function build(astroResult) {
    var ay = astroResult.ayanamsa;
    var trop = astroResult.planetsTropical;
    var grahas = {};
    GRAHA_ORDER.forEach(function (name) {
      var sidLon = norm360(trop[name].lon - ay);
      grahas[name] = decompose(sidLon);
      grahas[name].name = name;
      grahas[name].abbr = GRAHA_ABBR[name];
      // Retrograde flag from the astronomy layer (Sun/Moon never; nodes always). Used to
      // parenthesise the abbreviation, e.g. "(Ju)", per the standard convention.
      grahas[name].retro = !!trop[name].retro;
      grahas[name].label = grahas[name].retro ? "(" + GRAHA_ABBR[name] + ")" : GRAHA_ABBR[name];
    });
    var ascSid = norm360(astroResult.ascendantTropical - ay);
    var ascendant = decompose(ascSid);

    return {
      ayanamsa: ay,
      obliquity: astroResult.obliquity,
      grahas: grahas,
      ascendant: ascendant,
      order: GRAHA_ORDER.slice()
    };
  }

  // Tithi from Moon − Sun (sidereal difference equals tropical difference).
  function tithi(sunLonSid, moonLonSid) {
    var diff = norm360(moonLonSid - sunLonSid);
    var index = Math.floor(diff / 12); // 0..29
    var paksha = index < 15 ? "Shukla" : "Krishna";
    var within = index % 15; // 0..14
    var name;
    if (within === 14 && index < 15) name = "Purnima";
    else if (within === 14) name = "Amavasya";
    else name = TITHI_NAME[within];
    // How much of the current tithi is still to run: each tithi spans 12° of elongation.
    var remainingPct = (1 - (diff - index * 12) / 12) * 100;
    var display = paksha + " " + name;
    return {
      index: index + 1, paksha: paksha, name: name, display: display,
      remainingPct: remainingPct,
      // e.g. "Krishna Ashtami (45% remaining)"
      displayFull: display + " (" + Math.round(remainingPct) + "% remaining)"
    };
  }

  // ---------------------------------------------------------------------------
  // Jaimini chara karakas (8-karaka scheme). See Decisions.md #4.
  // ---------------------------------------------------------------------------
  var KARAKA_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu"];
  var KARAKA_RANK = [
    { abbr: "AK", name: "Atmakaraka" },
    { abbr: "AmK", name: "Amatyakaraka" },
    { abbr: "BK", name: "Bhratrikaraka" },
    { abbr: "MK", name: "Matrikaraka" },
    { abbr: "PiK", name: "Pitrikaraka" },
    { abbr: "PuK", name: "Putrakaraka" },
    { abbr: "GK", name: "Gnatikaraka" },
    { abbr: "DK", name: "Darakaraka" }
  ];

  function charaKarakas(grahas) {
    var list = KARAKA_PLANETS.map(function (name) {
      var g = grahas[name];
      // Rahu is retrograde: its advancement is measured backward within the sign.
      var adv = name === "Rahu" ? 30 - g.inSign : g.inSign;
      return { name: name, adv: adv };
    });
    list.sort(function (a, b) { return b.adv - a.adv; });
    var map = {};
    list.forEach(function (item, i) {
      map[item.name] = KARAKA_RANK[i];
    });
    return map; // planet name -> {abbr,name}
  }

  // ---------------------------------------------------------------------------
  // Vimshottari dasha. See Decisions.md #10.
  // ---------------------------------------------------------------------------
  var DASHA_SEQ = [
    { lord: "Ketu", years: 7 }, { lord: "Venus", years: 20 }, { lord: "Sun", years: 6 },
    { lord: "Moon", years: 10 }, { lord: "Mars", years: 7 }, { lord: "Rahu", years: 18 },
    { lord: "Jupiter", years: 16 }, { lord: "Saturn", years: 19 }, { lord: "Mercury", years: 17 }
  ];
  // Mean length of a Vimshottari "year". A dasha year is one full revolution of the Sun in
  // TROPICAL longitude (360°), i.e. a tropical year, matching JHora (see Decisions.md #36;
  // this superseded the earlier sidereal-year choice). Used only as the Newton seed and as
  // the fallback when no live Sun ephemeris is supplied.
  var TROPICAL_YEAR_DAYS = 365.24219;

  function addYears(date, years) {
    return new Date(date.getTime() + years * TROPICAL_YEAR_DAYS * 86400000);
  }

  // Signed smallest angular difference, in (−180, 180].
  function wrap180(x) {
    x = ((x % 360) + 360) % 360;
    return x > 180 ? x - 360 : x;
  }

  // birthDate: JS Date; moonLonSid: sidereal Moon longitude (deg, drives the nakshatra/lord).
  // opts.sunLonAt(date) -> TROPICAL Sun longitude (deg) at that instant, and
  // opts.sunLon0        -> TROPICAL Sun longitude at birth. When supplied, dasha boundaries
  // are placed at the instants the Sun's tropical longitude has advanced by (age·360°), i.e.
  // the periods are measured by the Earth's actual revolution round the Sun (360° tropical =
  // one dasha-year, per JHora — item 4). Without them it falls back to mean years.
  function vimshottari(birthDate, moonLonSid, opts) {
    opts = opts || {};
    var sunLonAt = opts.sunLonAt;
    var sunLon0 = opts.sunLon0;

    var nakIndex = Math.floor(norm360(moonLonSid) / NAK_LEN);
    var startSeq = nakIndex % 9;
    var posInNak = norm360(moonLonSid) - nakIndex * NAK_LEN;
    var fraction = posInNak / NAK_LEN;

    var firstYears = DASHA_SEQ[startSeq].years;
    // Dasha-years already elapsed (within the first Maha Dasha) at the moment of birth.
    var elapsed = fraction * firstYears;

    var YEAR_MS = TROPICAL_YEAR_DAYS * 86400000;
    var speedPerMs = 360 / YEAR_MS; // mean solar angular speed, used as the Newton slope.

    // Map a dasha-age A (years since the first Maha Dasha began) to a calendar Date.
    // Relative to birth (age = `elapsed`, Sun at sunLon0), age A needs (A − elapsed)·360° of
    // extra solar longitude. Solve for the instant by Newton–Raphson on the true Sun.
    function dateAtAge(A) {
      var dAge = A - elapsed;
      if (!sunLonAt) return addYears(birthDate, dAge); // fallback: mean sidereal years
      var D = dAge * 360;                              // degrees of Sun motion from birth
      var t = birthDate.getTime() + dAge * YEAR_MS;    // first guess (mean-rate)
      var target = norm360(sunLon0 + D);
      for (var it = 0; it < 12; it++) {
        var resid = wrap180(sunLonAt(new Date(t)) - target); // small angular error (deg)
        t -= resid / speedPerMs;                             // Newton step
        if (Math.abs(resid) < 1e-7) break;                   // ~0.0004″
      }
      return new Date(t);
    }

    var mdStartDate = dateAtAge(0);
    var mahadashas = [];
    var mdStartAge = 0;
    var prevDate = mdStartDate;
    for (var i = 0; i < 9; i++) {
      var seqIndex = (startSeq + i) % 9;
      var md = DASHA_SEQ[seqIndex];
      var antars = [];
      var aStartAge = mdStartAge;
      var aStartDate = prevDate;
      for (var j = 0; j < 9; j++) {
        var aSeq = (seqIndex + j) % 9;
        var ad = DASHA_SEQ[aSeq];
        var adYears = md.years * ad.years / 120;
        var aEndAge = aStartAge + adYears;
        var aEndDate = dateAtAge(aEndAge);
        antars.push({ lord: ad.lord, start: aStartDate, end: aEndDate, years: adYears });
        aStartAge = aEndAge; aStartDate = aEndDate;
      }
      // The last antardasha's end coincides with the maha dasha's end.
      mahadashas.push({ lord: md.lord, start: prevDate, end: aStartDate,
        years: md.years, antars: antars });
      mdStartAge += md.years; prevDate = aStartDate;
    }

    // The first maha dasha is the running (balance) dasha, so it began before birth. Drop the
    // antardashas that finished before birth and start the running one at the birth instant,
    // so the timeline begins at birth (v0.5.2 item 3).
    var bt = birthDate.getTime();
    var first = mahadashas[0];
    first.antars = first.antars.filter(function (ad) { return ad.end.getTime() > bt; });
    if (first.antars.length && first.antars[0].start.getTime() < bt) {
      first.antars[0].start = new Date(bt);
    }

    return { balanceStart: mdStartDate, mahadashas: mahadashas };
  }

  global.Jyotish = {
    build: build,
    decompose: decompose,
    tithi: tithi,
    charaKarakas: charaKarakas,
    vimshottari: vimshottari,
    SIGN_ABBR: SIGN_ABBR,
    SIGN_NAME: SIGN_NAME,
    NAKSHATRA: NAKSHATRA,
    GRAHA_ORDER: GRAHA_ORDER,
    GRAHA_ABBR: GRAHA_ABBR
  };
})(typeof window !== "undefined" ? window : globalThis);
