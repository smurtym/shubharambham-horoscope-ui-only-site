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
    return { index: index + 1, paksha: paksha, name: name, display: paksha + " " + name };
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
  var YEAR_DAYS = 365.25;

  function addYears(date, years) {
    return new Date(date.getTime() + years * YEAR_DAYS * 86400000);
  }

  // birthDate: JS Date; moonLonSid: sidereal Moon longitude (deg).
  function vimshottari(birthDate, moonLonSid) {
    var nakIndex = Math.floor(norm360(moonLonSid) / NAK_LEN);
    var startSeq = nakIndex % 9;
    var posInNak = norm360(moonLonSid) - nakIndex * NAK_LEN;
    var fraction = posInNak / NAK_LEN;

    var firstYears = DASHA_SEQ[startSeq].years;
    var elapsed = fraction * firstYears;
    // The first Maha Dasha began this many years before birth.
    var mdStart = addYears(birthDate, -elapsed);

    var mahadashas = [];
    var cursor = mdStart;
    for (var i = 0; i < 9; i++) {
      var seqIndex = (startSeq + i) % 9;
      var md = DASHA_SEQ[seqIndex];
      var mdEnd = addYears(cursor, md.years);
      // Antardashas within this Maha Dasha.
      var antars = [];
      var aCursor = cursor;
      for (var j = 0; j < 9; j++) {
        var aSeq = (seqIndex + j) % 9;
        var ad = DASHA_SEQ[aSeq];
        var adYears = md.years * ad.years / 120;
        var adEnd = addYears(aCursor, adYears);
        antars.push({ lord: ad.lord, start: aCursor, end: adEnd, years: adYears });
        aCursor = adEnd;
      }
      mahadashas.push({ lord: md.lord, start: cursor, end: mdEnd, years: md.years, antars: antars });
      cursor = mdEnd;
    }
    return { balanceStart: mdStart, mahadashas: mahadashas };
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
