/*
 * astro.js — astronomy layer backed by Swiss Ephemeris compiled to WebAssembly.
 *
 * Part of Shubharambham Horoscope (AGPL-3.0). See README.md, Decisions.md, and
 * vendor/sweph/README.md.
 *
 * As of v0.2.0 this module is a thin wrapper over the real Swiss Ephemeris (2.10.03),
 * compiled to WASM in Moshier mode (no data files). It replaces the pure-JS approximation
 * used in v0.1.0 but keeps the exact same public surface so nothing downstream changed:
 *
 *   Astro.compute(date, latDeg, lonDeg) -> {
 *     jdUT, obliquity, ayanamsa, planetsTropical: {Name:{lon,lat}}, ascendantTropical
 *   }
 *   Astro.norm360(x)
 *   Astro.julianDayFromDate(date)
 *   Astro.ready() -> Promise   // NEW in v0.2.0: resolves once the WASM module is loaded.
 *
 * WASM instantiation is asynchronous, so callers must `await Astro.ready()` once before the
 * first `Astro.compute()`. compute() itself stays synchronous. The vendor/sweph/sweph.js
 * script (which defines the global SwephModule factory) must be loaded before this file.
 */
(function (global) {
  "use strict";

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }

  // Julian Day (UT) from a JS Date (an absolute UTC instant).
  function julianDayFromDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  // The order in which se_compute() writes the output array (see vendor/sweph/se_shim.c).
  // [0..9]  longitudes of the ten bodies below
  // [10]    ayanamsa    [11] ascendant    [12] obliquity
  // [13..22] longitude speed (deg/day) of bodies [0..9]; negative = retrograde.
  var OUT_LABELS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
    "Uranus", "Neptune", "Rahu"];
  var NOUT = 23;

  var Mod = null;        // the instantiated Emscripten module
  var outPtr = 0;        // reusable heap buffer for the 13 output doubles
  var errPtr = 0;        // reusable 256-byte error buffer
  var se_compute = null; // cwrap'd entry point
  var readyPromise = null;

  // Load and instantiate the WASM module exactly once.
  function ready() {
    if (readyPromise) return readyPromise;
    if (typeof global.SwephModule !== "function") {
      readyPromise = Promise.reject(new Error(
        "Swiss Ephemeris module not found. vendor/sweph/sweph.js must load before js/astro.js."));
      return readyPromise;
    }
    readyPromise = global.SwephModule().then(function (m) {
      Mod = m;
      outPtr = Mod._malloc(NOUT * 8);   // 8 bytes per double
      errPtr = Mod._malloc(256);
      se_compute = Mod.cwrap("se_compute", "number",
        ["number", "number", "number", "number", "number"]);
      return true;
    });
    return readyPromise;
  }

  // Compute a full set of tropical positions for an instant & location.
  // date: JS Date (UTC instant). lat/lon: observer geographic degrees (N, E positive).
  // Must be called after `await Astro.ready()`.
  function compute(date, latDeg, lonDeg) {
    if (!se_compute) {
      throw new Error("Astro.compute() called before Astro.ready() resolved.");
    }
    var jdUT = julianDayFromDate(date);
    var rc = se_compute(jdUT, latDeg, lonDeg, outPtr, errPtr);
    if (rc !== 0) {
      throw new Error("Swiss Ephemeris error: " + Mod.UTF8ToString(errPtr));
    }
    // Read the 13 doubles back out of the WASM heap.
    var base = outPtr >> 3; // HEAPF64 index
    var vals = new Array(NOUT);
    for (var i = 0; i < NOUT; i++) vals[i] = Mod.HEAPF64[base + i];

    var planets = {};
    for (var j = 0; j < OUT_LABELS.length; j++) {
      // Latitude is not needed by the Jyotish layer (signs/nakshatra use longitude only),
      // so it is not returned by the shim; report 0 to preserve the {lon,lat} shape.
      // speed is the longitude speed (deg/day); retro = moving backwards.
      var speed = vals[13 + j];
      planets[OUT_LABELS[j]] = { lon: norm360(vals[j]), lat: 0, speed: speed, retro: speed < 0 };
    }
    // Rahu/Ketu (the lunar nodes) are retrograde by tradition and always marked so, even
    // though the *true* node momentarily turns direct near its stations. Ketu is the point
    // opposite Rahu, so it shares Rahu's motion.
    planets.Rahu.retro = true;
    planets.Ketu = { lon: norm360(planets.Rahu.lon + 180), lat: 0,
      speed: planets.Rahu.speed, retro: true };

    return {
      jdUT: jdUT,
      obliquity: vals[12],
      ayanamsa: vals[10],
      planetsTropical: planets,
      ascendantTropical: norm360(vals[11])
    };
  }

  global.Astro = {
    compute: compute,
    ready: ready,
    norm360: norm360,
    julianDayFromDate: julianDayFromDate
  };
})(typeof window !== "undefined" ? window : globalThis);
