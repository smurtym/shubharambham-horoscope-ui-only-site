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

  var MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct",
    "Nov", "Dec"];

  // Populate the Day/Month/Year dropdowns (dd/mm/yyyy order). Years run 2030→1900, which
  // covers realistic birth dates; extend the range here if ever needed (v0.4.2 item 2).
  function populateDate() {
    var daySel = byId("day");
    for (var d = 1; d <= 31; d++) {
      var od = document.createElement("option");
      od.value = String(d); od.textContent = pad(d);
      daySel.appendChild(od);
    }
    var monSel = byId("month");
    for (var mo = 1; mo <= 12; mo++) {
      var om = document.createElement("option");
      om.value = String(mo); om.textContent = pad(mo) + " (" + MONTH_ABBR[mo - 1] + ")";
      monSel.appendChild(om);
    }
    var yearSel = byId("year");
    for (var y = 2030; y >= 1900; y--) {
      var oy = document.createElement("option");
      oy.value = String(y); oy.textContent = String(y);
      yearSel.appendChild(oy);
    }
  }

  // Read the Day/Month/Year dropdowns into {y,mo,d} with real-calendar validation, or null.
  function readDate() {
    var d = byId("day").value, mo = byId("month").value, y = byId("year").value;
    if (d === "" || mo === "" || y === "") return null;
    d = +d; mo = +mo; y = +y;
    // Reject impossible dates (e.g. 31 Feb) by round-tripping through Date.
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

    var dmy = readDate();                           // {y,mo,d} from the dropdowns
    var hour = byId("hour").value;
    var minute = byId("minute").value;
    var placeId = byId("place").value;

    if (!dmy) return showError("Please select a valid birth date (day, month and year).");
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
    populateDate();
    populateTime();
    byId("birth-form").addEventListener("submit", onSubmit);
  });
})();
