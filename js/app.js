/*
 * app.js — home-page form logic.
 *
 * Part of Shubharambham Horoscope (AGPL-3.0). Drives the searchable place combobox, the
 * date/time inputs, validates the form, builds the person payload, and navigates to
 * result.html with the encoded state.
 */
(function () {
  "use strict";

  function byId(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // ---- Birth place: a custom, reliable combobox -----------------------------
  // The native <datalist> was unreliable (broken filtering on desktop, rendered as keyboard
  // suggestions on iOS). This is a small vanilla combobox instead (v0.5.1 item 1).
  var PLACES_SORTED = [];   // [{ id, label }] sorted by city
  var selectedPlaceId = null;

  function setupPlaceCombo() {
    PLACES_SORTED = (window.PLACES || []).slice().sort(function (a, b) {
      return a.city.localeCompare(b.city);
    }).map(function (p) {
      return { id: p.id, label: p.city + " — " + p.region };
    });

    var input = byId("place");
    var list = byId("place-results");
    var active = -1;        // index of the highlighted option within `shown`
    var shown = [];         // the currently displayed subset of PLACES_SORTED

    function open() { list.hidden = false; input.setAttribute("aria-expanded", "true"); }
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; }

    function render(query) {
      var q = query.trim().toLowerCase();
      shown = PLACES_SORTED.filter(function (p) {
        return q === "" || p.label.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 60);
      list.innerHTML = "";
      shown.forEach(function (p, i) {
        var li = document.createElement("li");
        li.setAttribute("role", "option");
        li.dataset.id = p.id;
        li.textContent = p.label;
        if (i === active) li.className = "active";
        list.appendChild(li);
      });
      if (shown.length) open(); else close();
    }

    function choose(i) {
      if (i < 0 || i >= shown.length) return;
      selectedPlaceId = shown[i].id;
      input.value = shown[i].label;
      close();
    }

    function highlight(next) {
      if (list.hidden) { render(input.value); return; }
      if (!shown.length) return;
      active = (next + shown.length) % shown.length;
      var lis = list.querySelectorAll("li");
      lis.forEach(function (li, i) { li.classList.toggle("active", i === active); });
      if (lis[active]) lis[active].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", function () { selectedPlaceId = null; render(input.value); });
    input.addEventListener("focus", function () { render(input.value); });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); highlight(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight(active - 1); }
      else if (e.key === "Enter") {
        if (!list.hidden && active >= 0) { e.preventDefault(); choose(active); }
      } else if (e.key === "Escape") { close(); }
    });
    // mousedown (not click) so selection fires before the input's blur closes the list.
    list.addEventListener("mousedown", function (e) {
      var li = e.target.closest("li");
      if (!li) return;
      e.preventDefault();
      choose(shown.findIndex(function (p) { return p.id === li.dataset.id; }));
    });
  }

  // Resolve whatever is in the place input to a dataset id: the explicit selection, or an
  // exact (case-insensitive) label match if the user typed a full name without clicking.
  function resolvePlaceId() {
    if (selectedPlaceId) return selectedPlaceId;
    var v = byId("place").value.trim().toLowerCase();
    var hit = PLACES_SORTED.filter(function (p) { return p.label.toLowerCase() === v; })[0];
    return hit ? hit.id : null;
  }

  // ---- Date: Day/Month/Year dropdowns (v0.5.2 item 1) -----------------------
  // Native <input type="date"> was dropped again because its display format follows the
  // browser locale (showed mm/dd/yyyy for the user). Dropdowns are unambiguous dd/mm/yyyy.
  var MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct",
    "Nov", "Dec"];

  function populateDate() {
    var now = new Date();
    var daySel = byId("day");
    for (var d = 1; d <= 31; d++) {
      daySel.appendChild(new Option(pad(d), String(d)));
    }
    var monSel = byId("month");
    for (var mo = 1; mo <= 12; mo++) {
      monSel.appendChild(new Option(pad(mo) + " (" + MONTH_ABBR[mo - 1] + ")", String(mo)));
    }
    var yearSel = byId("year");
    for (var y = 2100; y >= 1950; y--) {
      yearSel.appendChild(new Option(String(y), String(y)));
    }
    // Default to today's date (item 1).
    daySel.value = String(now.getDate());
    monSel.value = String(now.getMonth() + 1);
    yearSel.value = String(now.getFullYear());
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

  // ---- Time dropdowns -------------------------------------------------------
  // Hours read as "14 (2 PM)" so the 24-hour value and its 12-hour form are both visible.
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
    // Default to the current local time (v0.5.4 item 2), matching the date defaulting to today.
    var now = new Date();
    hourSel.value = String(now.getHours());
    minSel.value = String(now.getMinutes());
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
    var placeId = resolvePlaceId();

    if (!dmy) return showError("Please select a valid birth date (day, month and year).");
    if (hour === "" || minute === "") return showError("Please select the birth hour and minute.");
    if (!placeId) return showError("Please pick a birth place from the list.");

    var h = parseInt(hour, 10), mi = parseInt(minute, 10);
    if (h < 0 || h > 23 || mi < 0 || mi > 59) {
      return showError("Please select a valid time (hour 0–23, minute 0–59).");
    }

    // Internal payload keeps the ISO local datetime; seconds are always :00.
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
    setupPlaceCombo();
    populateDate();
    populateTime();
    byId("birth-form").addEventListener("submit", onSubmit);
  });
})();
