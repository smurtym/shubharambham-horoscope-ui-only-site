/*
 * astro.js — a self-contained, pure-JavaScript ephemeris.
 *
 * Part of Shubharambham Horoscope (AGPL-3.0). See README.md and Decisions.md.
 *
 * This module computes the geocentric ecliptic (tropical) longitudes of the Sun, Moon,
 * planets and lunar nodes, plus the ayanamsa (True Chitrapaksha) and the ascendant.
 * It is intentionally isolated behind the global `Astro` object so that it can later be
 * replaced by a Swiss Ephemeris WebAssembly build without touching the rest of the app.
 *
 * Accuracy target: ~1 arc-minute for planets, a few arc-minutes for the Moon, over
 * roughly 1800–2100. Light-time and aberration are omitted. See Decisions.md #1.
 *
 * Sources: JPL/Standish "Keplerian Elements and their rates"; J. Meeus, "Astronomical
 * Algorithms" (2nd ed.) chapters 21 (precession), 22 (nutation/obliquity), 47 (Moon).
 */
(function (global) {
  "use strict";

  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function sind(x) { return Math.sin(x * DEG); }
  function cosd(x) { return Math.cos(x * DEG); }
  function tand(x) { return Math.tan(x * DEG); }

  // ---------------------------------------------------------------------------
  // Time
  // ---------------------------------------------------------------------------

  // Julian Day (UT) from a JS Date (which is an absolute UTC instant).
  function julianDayFromDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  // ΔT (TT − UT), seconds. Espenak & Meeus piecewise polynomials (approximate).
  function deltaTSeconds(year) {
    var u, t;
    if (year >= 2005 && year <= 2050) {
      t = year - 2000;
      return 62.92 + 0.32217 * t + 0.005589 * t * t;
    }
    if (year >= 1986 && year < 2005) {
      t = year - 2000;
      return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t +
        0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5);
    }
    if (year >= 1961 && year < 1986) {
      t = year - 1975;
      return 45.45 + 1.067 * t - t * t / 260 - t * t * t / 718;
    }
    if (year >= 1900 && year < 1961) {
      t = year - 1900;
      return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t -
        0.000197 * Math.pow(t, 4);
    }
    if (year > 2050) {
      u = (year - 1820) / 100;
      return -20 + 32 * u * u - 0.5628 * (2150 - year);
    }
    // Fallback (pre-1900): coarse.
    u = (year - 1820) / 100;
    return -20 + 32 * u * u;
  }

  // Julian centuries (TT) from J2000, given JD in UT and calendar year.
  function centuriesTT(jdUT, year) {
    var jdTT = jdUT + deltaTSeconds(year) / 86400;
    return (jdTT - 2451545.0) / 36525;
  }

  // ---------------------------------------------------------------------------
  // Obliquity & nutation (Meeus Ch. 22, truncated)
  // ---------------------------------------------------------------------------

  // Returns { dpsi, deps } in degrees (nutation in longitude and obliquity).
  function nutation(T) {
    var omega = 125.04452 - 1934.136261 * T; // mean longitude of ascending node
    var L = 280.4665 + 36000.7698 * T;       // mean longitude of Sun
    var Lp = 218.3165 + 481267.8813 * T;     // mean longitude of Moon
    var dpsi = (-17.20 * sind(omega) - 1.32 * sind(2 * L) -
      0.23 * sind(2 * Lp) + 0.21 * sind(2 * omega)) / 3600;
    var deps = (9.20 * cosd(omega) + 0.57 * cosd(2 * L) +
      0.10 * cosd(2 * Lp) - 0.09 * cosd(2 * omega)) / 3600;
    return { dpsi: dpsi, deps: deps };
  }

  // Mean obliquity of the ecliptic (degrees).
  function meanObliquity(T) {
    var sec = 21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813));
    return 23 + (26 + sec / 60) / 60;
  }

  // ---------------------------------------------------------------------------
  // Planets via JPL/Standish Keplerian elements (heliocentric, ecliptic J2000)
  // ---------------------------------------------------------------------------
  // Each row: a(AU), e, I(deg), L(deg), longPeri(deg), longNode(deg) + centuryrates.
  var ELEMENTS = {
    Mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    Venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
      0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    Earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
      0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    Mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    Jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    Saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
      -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    Uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
    Neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]
  };

  // Solve Kepler's equation for eccentric anomaly (degrees in, degrees out).
  function eccentricAnomaly(Mdeg, e) {
    var M = norm360(Mdeg);
    if (M > 180) M -= 360;
    var E = M + (e * RAD) * sind(M); // initial guess (e in radians magnitude)
    for (var i = 0; i < 12; i++) {
      var dM = M - (E - e * RAD * sind(E));
      var dE = dM / (1 - e * cosd(E));
      E += dE;
      if (Math.abs(dE) < 1e-9) break;
    }
    return E;
  }

  // Heliocentric ecliptic (J2000) rectangular coordinates of a planet, AU.
  function heliocentricXYZ(name, T) {
    var el = ELEMENTS[name];
    var a = el[0] + el[6] * T;
    var e = el[1] + el[7] * T;
    var I = el[2] + el[8] * T;
    var L = el[3] + el[9] * T;
    var wbar = el[4] + el[10] * T; // longitude of perihelion
    var node = el[5] + el[11] * T; // longitude of ascending node
    var argPeri = wbar - node;
    var M = L - wbar;
    var E = eccentricAnomaly(M, e);
    // Position in orbital plane.
    var xv = a * (cosd(E) - e);
    var yv = a * (Math.sqrt(1 - e * e) * sind(E));
    // Rotate to ecliptic J2000.
    var co = cosd(node), so = sind(node), ci = cosd(I), si = sind(I),
      cw = cosd(argPeri), sw = sind(argPeri);
    var x = (co * cw - so * sw * ci) * xv + (-co * sw - so * cw * ci) * yv;
    var y = (so * cw + co * sw * ci) * xv + (-so * sw + co * cw * ci) * yv;
    var z = (sw * si) * xv + (cw * si) * yv;
    return { x: x, y: y, z: z };
  }

  // Geocentric ecliptic (J2000) longitude & latitude of a planet, degrees.
  function geocentricPlanet(name, T) {
    var p = heliocentricXYZ(name, T);
    var earth = heliocentricXYZ("Earth", T);
    var x = p.x - earth.x, y = p.y - earth.y, z = p.z - earth.z;
    var lon = norm360(Math.atan2(y, x) * RAD);
    var lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD;
    return { lon: lon, lat: lat };
  }

  // Geocentric Sun longitude (J2000 ecliptic): opposite the Earth's heliocentric position.
  function sunLongitude(T) {
    var earth = heliocentricXYZ("Earth", T);
    return norm360(Math.atan2(-earth.y, -earth.x) * RAD);
  }

  // ---------------------------------------------------------------------------
  // Precession of ecliptic longitude from J2000 to date (Meeus, simplified)
  // ---------------------------------------------------------------------------
  // The Keplerian-element longitudes above are referred to the fixed ecliptic & equinox
  // of J2000. To express a tropical longitude of date we add general precession in
  // longitude, p = 5028.796195"*T + 1.1054348"*T^2 (Meeus 21.6), in degrees.
  function precessionJ2000ToDate(T) {
    return (5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T * T * T) / 3600;
  }

  // ---------------------------------------------------------------------------
  // Moon (Meeus Ch. 47, truncated main-problem series)
  // ---------------------------------------------------------------------------
  // Terms: [D, M, Mp, F, coeff(1e-6 deg)]. ~34 largest longitude terms.
  var MOON_TERMS = [
    [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314],
    [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
    [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322],
    [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
    [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
    [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
    [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766],
    [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
    [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665],
    [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
    [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120],
    [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048]
  ];

  // Returns apparent geocentric ecliptic longitude of the Moon (degrees, of date).
  // dpsi = nutation in longitude (degrees) added by caller for apparent position.
  function moonLongitude(T, dpsi) {
    var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T +
      T * T * T / 538841 - T * T * T * T / 65194000;
    var D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T +
      T * T * T / 545868 - T * T * T * T / 113065000;
    var M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T +
      T * T * T / 24490000;
    var Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T +
      T * T * T / 69699 - T * T * T * T / 14712000;
    var F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T -
      T * T * T / 3526000 + T * T * T * T / 863310000;
    var E = 1 - 0.002516 * T - 0.0000074 * T * T;
    var sumL = 0;
    for (var i = 0; i < MOON_TERMS.length; i++) {
      var t = MOON_TERMS[i];
      var arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      var coeff = t[4];
      var em = Math.abs(t[1]);
      if (em === 1) coeff *= E; else if (em === 2) coeff *= E * E;
      sumL += coeff * sind(arg);
    }
    return norm360(Lp + sumL / 1e6 + dpsi);
  }

  // Mean longitude of the ascending lunar node (Rahu), degrees of date.
  // Meeus 47.7 (mean node). Ketu = Rahu + 180.
  function rahuLongitude(T, dpsi) {
    var omega = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T +
      T * T * T / 467441 - T * T * T * T / 60616000;
    return norm360(omega + dpsi);
  }

  // ---------------------------------------------------------------------------
  // Ayanamsa: True Chitrapaksha, from apparent longitude of Spica − 180° (Decisions #2)
  // ---------------------------------------------------------------------------
  // Spica (alpha Virginis) mean equatorial J2000: RA, Dec (degrees).
  var SPICA_RA0 = 201.2983;   // 13h25m11.6s
  var SPICA_DEC0 = -11.1614;  // -11°09'41"

  function ayanamsa(T, eps, dpsi) {
    // Precession angles J2000 -> date (Meeus 21.2), arcsec -> deg.
    var zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600;
    var z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600;
    var theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600;
    var A = cosd(SPICA_DEC0) * sind(SPICA_RA0 + zeta);
    var B = cosd(theta) * cosd(SPICA_DEC0) * cosd(SPICA_RA0 + zeta) -
      sind(theta) * sind(SPICA_DEC0);
    var C = sind(theta) * cosd(SPICA_DEC0) * cosd(SPICA_RA0 + zeta) +
      cosd(theta) * sind(SPICA_DEC0);
    var ra = norm360(Math.atan2(A, B) * RAD + z);
    var dec = Math.asin(C) * RAD;
    // Equatorial (of date, true equinox) -> ecliptic longitude.
    var lon = Math.atan2(
      sind(ra) * cosd(eps) + tand(dec) * sind(eps),
      cosd(ra)
    ) * RAD;
    lon = norm360(lon + dpsi); // apparent longitude of Spica
    return norm360(lon - 180);
  }

  // ---------------------------------------------------------------------------
  // Sidereal time & ascendant
  // ---------------------------------------------------------------------------
  // Greenwich apparent sidereal time (degrees) from JD(UT).
  function gast(jdUT, eps, dpsi) {
    var T = (jdUT - 2451545.0) / 36525;
    var gmst = 280.46061837 + 360.98564736629 * (jdUT - 2451545.0) +
      0.000387933 * T * T - T * T * T / 38710000;
    return norm360(gmst + dpsi * cosd(eps));
  }

  // Tropical ascendant longitude (degrees) from RAMC, obliquity, geographic latitude.
  function ascendant(ramc, eps, latDeg) {
    var y = cosd(ramc);
    var x = -(sind(ramc) * cosd(eps) + tand(latDeg) * sind(eps));
    return norm360(Math.atan2(y, x) * RAD);
  }

  // ---------------------------------------------------------------------------
  // Public: compute a full set of tropical positions for an instant & location.
  // ---------------------------------------------------------------------------
  // date: JS Date (UTC instant). lat/lon: observer geographic degrees (E, N positive).
  // Returns tropical longitudes of date plus the ayanamsa; the Jyotish layer converts
  // to sidereal.
  function compute(date, latDeg, lonDeg) {
    var jdUT = julianDayFromDate(date);
    var year = date.getUTCFullYear() +
      (date.getUTCMonth() + 1) / 12; // fractional year for ΔT
    var T = centuriesTT(jdUT, date.getUTCFullYear());
    var nut = nutation(T);
    var eps = meanObliquity(T) + nut.deps;
    var precA = precessionJ2000ToDate(T);

    function tropical(name) {
      var g = geocentricPlanet(name, T);
      return { lon: norm360(g.lon + precA + nut.dpsi), lat: g.lat };
    }

    var planets = {
      Sun: { lon: norm360(sunLongitude(T) + precA + nut.dpsi), lat: 0 },
      Moon: { lon: moonLongitude(T, nut.dpsi), lat: 0 },
      Mars: tropical("Mars"),
      Mercury: tropical("Mercury"),
      Jupiter: tropical("Jupiter"),
      Venus: tropical("Venus"),
      Saturn: tropical("Saturn"),
      Uranus: tropical("Uranus"),
      Neptune: tropical("Neptune")
    };
    var rahu = rahuLongitude(T, nut.dpsi);
    planets.Rahu = { lon: rahu, lat: 0 };
    planets.Ketu = { lon: norm360(rahu + 180), lat: 0 };

    var ay = ayanamsa(T, eps, nut.dpsi);

    // Ascendant.
    var gastDeg = gast(jdUT, eps, nut.dpsi);
    var ramc = norm360(gastDeg + lonDeg);
    var ascTropical = ascendant(ramc, eps, latDeg);

    return {
      jdUT: jdUT,
      obliquity: eps,
      ayanamsa: ay,
      planetsTropical: planets,
      ascendantTropical: ascTropical
    };
  }

  global.Astro = {
    compute: compute,
    julianDayFromDate: julianDayFromDate,
    deltaTSeconds: deltaTSeconds,
    norm360: norm360,
    _internal: {
      geocentricPlanet: geocentricPlanet,
      sunLongitude: sunLongitude,
      moonLongitude: moonLongitude,
      ayanamsa: ayanamsa,
      nutation: nutation,
      meanObliquity: meanObliquity
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
