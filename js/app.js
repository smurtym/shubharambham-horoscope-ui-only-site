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

  function showError(msg) {
    var el = byId("form-error");
    el.textContent = msg;
    el.hidden = false;
  }

  function onSubmit(e) {
    e.preventDefault();
    byId("form-error").hidden = true;

    var date = byId("date").value;                 // "YYYY-MM-DD"
    var hour = byId("hour").value;
    var minute = byId("minute").value;
    var second = byId("second").value;
    var placeId = byId("place").value;

    if (!date) return showError("Please enter the birth date.");
    if (hour === "" || minute === "") return showError("Please enter the birth hour and minute.");
    if (!placeId) return showError("Please select the birth place.");

    var h = parseInt(hour, 10), mi = parseInt(minute, 10),
      s = second === "" ? 0 : parseInt(second, 10);
    if (h < 0 || h > 23 || mi < 0 || mi > 59 || s < 0 || s > 59) {
      return showError("Please enter a valid time (hour 0–23, minute/second 0–59).");
    }

    var dateTime = date + "T" + pad(h) + ":" + pad(mi) + ":" + pad(s);

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
    byId("birth-form").addEventListener("submit", onSubmit);
  });
})();
