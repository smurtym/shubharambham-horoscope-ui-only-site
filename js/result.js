/*
 * result.js — result-page rendering.
 *
 * Part of Shubharambham Horoscope (AGPL-3.0). Decodes the person payload from the URL,
 * drives the astronomy + Jyotish layers, and renders the full horoscope: computed values,
 * D1/D9 charts (with an on-screen format switcher), the planetary table with karakas, and
 * the Vimshottari dasha accordion. Also wires Share / Download PDF / Print.
 */
(function () {
  "use strict";

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct",
    "Nov", "Dec"];

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // "05 Jul 2026" from a Date, using UTC components (deterministic, tz-independent).
  function fmtDate(d) {
    return pad2(d.getUTCDate()) + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  // "0 Ar 38' 12\"" — degree, sign, arcminutes, arcseconds (see README output format).
  function fmtPos(g) {
    return g.deg + " " + g.signAbbr + " " + pad2(g.min) + "' " + pad2(g.sec) + '"';
  }

  function showFatal(msg) {
    var content = document.getElementById("content");
    content.innerHTML = "";
    content.appendChild(el("div", "fatal",
      "<p>" + esc(msg) + "</p><p><a href=\"index.html\">← Back to the home page</a></p>"));
  }

  // -------------------------------------------------------------------------
  // Build the full data model from the encoded payload.
  // -------------------------------------------------------------------------
  function buildModel() {
    var params = new URLSearchParams(window.location.search);
    var d = params.get("d");
    if (!d) throw new Error("This link has no horoscope data. Please start from the home page.");

    var person;
    try { person = window.Common.decodePerson(d); }
    catch (e) { throw new Error("This link is not a valid horoscope link."); }

    var place = window.Common.placeById(person.BirthPlace);
    if (!place) throw new Error("The birth place in this link is not in the bundled dataset.");

    var birthDate = window.Common.birthInstant(person, place);
    if (!birthDate || isNaN(birthDate.getTime())) {
      throw new Error("The birth date/time in this link could not be read.");
    }

    var astro = window.Astro.compute(birthDate, place.lat, place.long);
    var chart = window.Jyotish.build(astro);

    var sunSid = chart.grahas.Sun.lon;
    var moonSid = chart.grahas.Moon.lon;
    var tithi = window.Jyotish.tithi(sunSid, moonSid);

    // Western (tropical) Sun sign.
    var sunTropLon = astro.planetsTropical.Sun.lon;
    var westernSign = Math.floor(sunTropLon / 30);

    var karakas = window.Jyotish.charaKarakas(chart.grahas);
    // Vimshottari is measured by the Sun's actual sidereal revolution (item 8): give the
    // dasha builder the Sun's sidereal longitude at any instant. Uses the dedicated Sun-only
    // fast path (v0.4.1 item 5) so the hundreds of root-finding evaluations stay cheap.
    var dasha = window.Jyotish.vimshottari(birthDate, moonSid,
      { sunLon0: sunSid, sunLonAt: window.Astro.sunSidLon });

    return {
      person: person,
      place: place,
      birthDate: birthDate,
      astro: astro,
      chart: chart,
      tithi: tithi,
      westernSign: westernSign,
      karakas: karakas,
      dasha: dasha,
      formatKey: window.Charts.formatKey(person.ChartType || "South Indian")
    };
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  function renderHeader(model, content) {
    var name = model.person.Name;
    var titleText = name ? name + "'s Horoscope" : "Horoscope";
    document.title = titleText;
    // The birth date/time/place line was moved into the Details card (v0.4.2 item 8).
    var header = el("header", "result-header");
    header.appendChild(el("h1", null, esc(titleText)));
    content.appendChild(header);
  }

  function renderComputed(model, content) {
    var g = model.chart.grahas, a = model.chart.ascendant, place = model.place;
    var SIGN = window.Jyotish.SIGN_NAME;
    var c = window.Common.parseLocalIso(model.person.DateTime);
    var dateStr = pad2(c.day) + " " + MONTHS[c.month - 1] + " " + c.year;
    var timeStr = pad2(c.hour) + ":" + pad2(c.minute);
    var rows = [];
    if (model.person.Gender) rows.push(["Gender", esc(model.person.Gender)]);
    rows.push(
      // Birth particulars, moved here from the page header (item 8).
      ["Date of birth", dateStr],
      ["Time of birth", timeStr],
      ["Place of birth", esc(place.city) + ", " + esc(place.region)],
      ["Latitude", place.lat.toFixed(4) + "°"],
      ["Longitude", place.long.toFixed(4) + "°"],
      ["Timezone", esc(place.tz)],
      ["Tithi", esc(model.tithi.displayFull)],
      ["Nakshatra", esc(g.Moon.nakshatra) + " (pada " + g.Moon.pada + ")"],
      ["Sun sign — Vedic (sidereal)", esc(g.Sun.signName)],
      ["Sun sign — Western (tropical)", esc(SIGN[model.westernSign])],
      // Moon sign only — the nakshatra already has its own row (item 7).
      ["Moon sign", esc(g.Moon.signName)],
      // Lagna as the sign name only; the degrees live in the planetary table (item 5).
      ["Lagna", esc(a.signName)]
    );
    var section = el("section", "card");
    section.appendChild(el("h2", null, "Details"));
    var dl = el("dl", "values");
    rows.forEach(function (r) {
      dl.appendChild(el("dt", null, r[0]));
      dl.appendChild(el("dd", null, r[1]));
    });
    section.appendChild(dl);
    content.appendChild(section);
  }

  // Build placements[12] of planet abbreviations for D1 (rasi) or D9 (navamsa).
  function placementsFor(model, divisional) {
    var out = [];
    for (var i = 0; i < 12; i++) out.push([]);
    model.chart.order.forEach(function (name) {
      var g = model.chart.grahas[name];
      var sign = divisional === "d9" ? g.navamsaSign : g.sign;
      // g.label parenthesises the abbreviation when the graha is retrograde, e.g. "(Ju)".
      out[sign].push(g.label || g.abbr);
    });
    return out;
  }

  function renderCharts(model, content) {
    var section = el("section", "card charts-card");
    section.appendChild(el("h2", null, "Charts"));

    var switcher = el("div", "chart-switcher no-print");
    [["south", "South Indian"], ["north", "North Indian"], ["east", "East Indian"]]
      .forEach(function (f) {
        var b = el("button", "chart-style-btn", f[1]);
        b.type = "button";
        b.dataset.format = f[0];
        b.addEventListener("click", function () {
          model.formatKey = f[0];
          drawCharts();
          updateSwitcher();
        });
        switcher.appendChild(b);
      });
    section.appendChild(switcher);

    var grid = el("div", "charts-grid");
    var d1 = el("figure", "chart-figure");
    var d1cap = el("figcaption", null, "D1 · Rasi");
    var d1svg = el("div", "chart-holder");
    d1.appendChild(d1svg); d1.appendChild(d1cap);
    var d9 = el("figure", "chart-figure");
    var d9cap = el("figcaption", null, "D9 · Navamsa");
    var d9svg = el("div", "chart-holder");
    d9.appendChild(d9svg); d9.appendChild(d9cap);
    grid.appendChild(d1); grid.appendChild(d9);
    section.appendChild(grid);
    content.appendChild(section);

    function drawCharts() {
      var asc = model.chart.ascendant;
      d1svg.innerHTML = window.Charts.render(model.formatKey,
        placementsFor(model, "d1"), asc.sign, { title: "D1" });
      d9svg.innerHTML = window.Charts.render(model.formatKey,
        placementsFor(model, "d9"), asc.navamsaSign, { title: "D9" });
    }
    function updateSwitcher() {
      switcher.querySelectorAll(".chart-style-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.format === model.formatKey);
      });
    }
    drawCharts();
    updateSwitcher();
  }

  function renderPlanets(model, content) {
    var section = el("section", "card");
    section.appendChild(el("h2", null, "Planetary positions"));
    var wrap = el("div", "table-scroll");
    var table = el("table", "planets");
    table.innerHTML =
      "<thead><tr>" +
      "<th>Planet</th><th>Position</th><th>Nakshatra (Pada)</th>" +
      "<th>Rasi</th><th>Navamsa</th><th>Karaka</th>" +
      "</tr></thead>";
    var tbody = el("tbody");
    // Lagna (ascendant) as the first row — same columns as a graha, no karaka (item 5).
    var a = model.chart.ascendant;
    var lagnaTr = el("tr");
    lagnaTr.innerHTML =
      "<td class=\"pl\" data-label=\"Planet\">Lagna <span class=\"abbr\">As</span></td>" +
      "<td data-label=\"Position\">" + esc(fmtPos(a)) + "</td>" +
      "<td data-label=\"Nakshatra (Pada)\">" + esc(a.nakshatra) + " " + a.pada + "</td>" +
      "<td data-label=\"Rasi\">" + esc(a.signAbbr) + "</td>" +
      "<td data-label=\"Navamsa\">" + esc(a.navamsaAbbr) + "</td>" +
      "<td data-label=\"Karaka\">—</td>";
    tbody.appendChild(lagnaTr);
    var PLANET_NAME = {
      Sun: "Sun", Moon: "Moon", Mars: "Mars", Mercury: "Mercury", Jupiter: "Jupiter",
      Venus: "Venus", Saturn: "Saturn", Rahu: "Rahu", Ketu: "Ketu"
    };
    model.chart.order.forEach(function (name) {
      var g = model.chart.grahas[name];
      var k = model.karakas[name];
      var tr = el("tr");
      // The abbreviation is parenthesised only when retrograde (g.label), matching the
      // charts, so "(Ju)" reads as a retrograde graha and "Ju" as direct.
      tr.innerHTML =
        "<td class=\"pl\" data-label=\"Planet\">" + esc(PLANET_NAME[name]) +
        " <span class=\"abbr" + (g.retro ? " retro" : "") + "\">" + esc(g.label) +
        "</span></td>" +
        "<td data-label=\"Position\">" + esc(fmtPos(g)) + "</td>" +
        "<td data-label=\"Nakshatra (Pada)\">" + esc(g.nakshatra) + " " + g.pada + "</td>" +
        "<td data-label=\"Rasi\">" + esc(g.signAbbr) + "</td>" +
        "<td data-label=\"Navamsa\">" + esc(g.navamsaAbbr) + "</td>" +
        "<td data-label=\"Karaka\">" + (k ? "<span class=\"karaka\">" + esc(k.abbr) +
          "</span> " + esc(k.name) : "—") + "</td>";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    section.appendChild(wrap);
    content.appendChild(section);
  }

  function renderDasha(model, content) {
    var section = el("section", "card dasha-card");
    section.appendChild(el("h2", null, "Vimshottari Dasha"));
    var list = el("div", "dasha-list");
    model.dasha.mahadashas.forEach(function (md) {
      var details = el("details", "dasha-md");
      var summary = el("summary");
      summary.innerHTML =
        "<span class=\"md-lord\">" + esc(md.lord) + "</span>" +
        "<span class=\"md-range\">" + fmtDate(md.start) + " – " + fmtDate(md.end) + "</span>" +
        "<span class=\"md-years\">" + md.years + " yrs</span>";
      details.appendChild(summary);
      var inner = el("div", "dasha-antars");
      var t = el("table", "antars");
      t.innerHTML = "<thead><tr><th>Antardasha</th><th>From</th><th>To</th></tr></thead>";
      var tb = el("tbody");
      md.antars.forEach(function (ad) {
        var tr = el("tr");
        tr.innerHTML = "<td>" + esc(ad.lord) + "</td><td>" + fmtDate(ad.start) +
          "</td><td>" + fmtDate(ad.end) + "</td>";
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      inner.appendChild(t);
      details.appendChild(inner);
      list.appendChild(details);
    });
    section.appendChild(list);
    content.appendChild(section);
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  function wireActions(model) {
    document.getElementById("print-btn").addEventListener("click", function () {
      window.print();
    });

    document.getElementById("share-btn").addEventListener("click", function () {
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          flash("Link copied to clipboard.");
        }, function () { prompt("Copy this link:", url); });
      } else {
        prompt("Copy this link:", url);
      }
    });

    document.getElementById("pdf-btn").addEventListener("click", function () {
      var btn = this;
      btn.disabled = true;
      var old = btn.textContent;
      btn.textContent = "Preparing…";
      window.PDF.generate(model).then(function (doc) {
        var fname = (model.person.Name || "horoscope").replace(/[^\w-]+/g, "_") + ".pdf";
        doc.save(fname);
      }).catch(function (e) {
        flash("Could not generate PDF: " + e.message);
      }).then(function () {
        btn.disabled = false;
        btn.textContent = old;
      });
    });
  }

  function flash(msg) {
    var f = document.getElementById("flash");
    if (!f) {
      f = el("div", "flash no-print");
      f.id = "flash";
      document.body.appendChild(f);
    }
    f.textContent = msg;
    f.classList.add("show");
    setTimeout(function () { f.classList.remove("show"); }, 2500);
  }

  // -------------------------------------------------------------------------
  function main() {
    // The Swiss Ephemeris WASM module loads asynchronously; wait for it before computing.
    window.Astro.ready().then(function () {
      var model;
      try {
        model = buildModel();
      } catch (e) {
        showFatal(e.message);
        return;
      }
      render(model);
    }).catch(function (e) {
      showFatal("The astronomy engine failed to load: " + e.message);
    });
  }

  function render(model) {
    var content = document.getElementById("content");
    content.innerHTML = "";
    renderHeader(model, content);
    renderComputed(model, content);
    renderCharts(model, content);
    renderPlanets(model, content);
    renderDasha(model, content);
    wireActions(model);

    // Expose for debugging / the PDF module.
    window.__model = model;
  }

  document.addEventListener("DOMContentLoaded", main);
})();
