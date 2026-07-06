/*
 * app.js — home-page form logic.
 *
 * Part of Shubharambham Horoscope (AGPL-3.0). Populates the place selector, validates the
 * form, builds the person payload, and navigates to result.html with the encoded state.
 */
(function () {
  "use strict";

  function byId(id) { return document.getElementById(id); }

  // Populate the place dropdown from the bundled dataset (sorted by city).
  function populatePlaces() {
    var select = byId("place");
    var places = (window.PLACES || []).slice().sort(function (a, b) {
      return a.city.localeCompare(b.city);
    });
    places.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.city + " — " + p.region;
      select.appendChild(opt);
    });
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Populate the hour (0–23) and minute (0–59) dropdowns. Hours read as "14 (2 PM)" so the
  // 24-hour value and its familiar 12-hour form are both visible (item 11).
  function populateTime() {
    var hourSel = byId("hour");
    for (var h = 0; h < 24; h++) {
      var h12 = ((h + 11) % 12) + 1;
      var ampm = h < 12 ? "AM" : "PM";
      var o = document.createElement("option");
      o.value = String(h);
      o.textContent = pad(h) + " (" + h12 + " " + ampm + ")";
      hourSel.appendChild(o);
    }
    var minSel = byId("minute");
    for (var m = 0; m < 60; m++) {
      var mo = document.createElement("option");
      mo.value = String(m);
      mo.textContent = pad(m);
      minSel.appendChild(mo);
    }
  }

  // Parse a dd/mm/yyyy string into {y,mo,d} with real-calendar validation, or null.
  function parseDmy(s) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || "").trim());
    if (!m) return null;
    var d = +m[1], mo = +m[2], y = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1 || y > 9999) return null;
    // Reject impossible dates (e.g. 31/02) by round-tripping through Date.
    var probe = new Date(Date.UTC(y, mo - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 ||
      probe.getUTCDate() !== d) return null;
    return { y: y, mo: mo, d: d };
  }

  function showError(msg) {
    var el = byId("form-error");
    el.textContent = msg;
    el.hidden = false;
  }

  function onSubmit(e) {
    e.preventDefault();
    byId("form-error").hidden = true;

    var dmy = parseDmy(byId("date").value);        // dd/mm/yyyy
    var hour = byId("hour").value;
    var minute = byId("minute").value;
    var placeId = byId("place").value;

    if (!dmy) return showError("Please enter the birth date as dd/mm/yyyy (e.g. 15/05/1990).");
    if (hour === "" || minute === "") return showError("Please select the birth hour and minute.");
    if (!placeId) return showError("Please select the birth place.");

    var h = parseInt(hour, 10), mi = parseInt(minute, 10);
    if (h < 0 || h > 23 || mi < 0 || mi > 59) {
      return showError("Please select a valid time (hour 0–23, minute 0–59).");
    }

    // Internal payload keeps the ISO local datetime; seconds are always :00 (item 10).
    var dateTime = dmy.y + "-" + pad(dmy.mo) + "-" + pad(dmy.d) +
      "T" + pad(h) + ":" + pad(mi) + ":00";

    var person = {
      Name: byId("name").value.trim(),
      Gender: byId("gender").value,
      DateTime: dateTime,
      BirthPlace: placeId,
      ChartType: byId("chart").value || "South Indian"
    };

    var encoded = window.Common.encodePerson(person);
    window.location.href = "result.html?d=" + encoded;
  }

  document.addEventListener("DOMContentLoaded", function () {
    populatePlaces();
    populateTime();
    byId("birth-form").addEventListener("submit", onSubmit);
  });
})();
