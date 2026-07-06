/*
 * common.js — shared helpers used by both the home and result pages.
 *
 * Part of Shubharambham Horoscope (AGPL-3.0). Person-payload encoding, place lookup, and
 * IANA-timezone -> UTC conversion. Depends on the global `PLACES` (js/places.js).
 */
(function (global) {
  "use strict";

  // --- Person payload: JSON <-> URL-safe Base64 (UTF-8 safe). See Decisions.md #6. ---
  function encodePerson(person) {
    var json = JSON.stringify(person);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function decodePerson(b64) {
    var json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  }

  // --- Place dataset lookup ---
  function placeById(id) {
    var list = global.PLACES || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  // --- Timezone: interpret a wall-clock local time in an IANA zone as a UTC instant. ---
  // Uses Intl.DateTimeFormat, which honours the platform tz database (historical DST etc).
  function tzOffsetMs(timeZone, utcDate) {
    var dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    var parts = dtf.formatToParts(utcDate);
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var hour = map.hour === "24" ? 0 : parseInt(map.hour, 10);
    var asUTC = Date.UTC(+map.year, map.month - 1, +map.day, hour, +map.minute, +map.second);
    return asUTC - utcDate.getTime();
  }

  // y,mo(1-12),d,h,mi,s in local wall-clock of `timeZone` -> JS Date (UTC instant).
  function zonedTimeToUtc(y, mo, d, h, mi, s, timeZone) {
    var guess = Date.UTC(y, mo - 1, d, h, mi, s);
    var off = tzOffsetMs(timeZone, new Date(guess));
    var utc = guess - off;
    // Refine once to resolve DST-boundary ambiguity.
    off = tzOffsetMs(timeZone, new Date(utc));
    return new Date(guess - off);
  }

  // Parse an ISO-8601 local datetime string ("YYYY-MM-DDTHH:MM[:SS]") into components.
  function parseLocalIso(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso);
    if (!m) return null;
    return {
      year: +m[1], month: +m[2], day: +m[3],
      hour: +m[4], minute: +m[5], second: m[6] ? +m[6] : 0
    };
  }

  // Resolve a person + place into the UTC instant of birth.
  function birthInstant(person, place) {
    var c = parseLocalIso(person.DateTime);
    if (!c) return null;
    return zonedTimeToUtc(c.year, c.month, c.day, c.hour, c.minute, c.second, place.tz);
  }

  global.Common = {
    encodePerson: encodePerson,
    decodePerson: decodePerson,
    placeById: placeById,
    zonedTimeToUtc: zonedTimeToUtc,
    parseLocalIso: parseLocalIso,
    birthInstant: birthInstant
  };
})(typeof window !== "undefined" ? window : globalThis);
