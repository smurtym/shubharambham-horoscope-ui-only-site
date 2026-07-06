/*
 * charts.js — SVG renderers for the three regional chart formats.
 *
 * Part of Shubharambham Horoscope (AGPL-3.0). See README.md ("Charts (SVG)") and
 * Decisions.md #8. Every chart is a self-contained <svg> string with a 360×360 viewBox so
 * it scales cleanly on any screen and prints sharply.
 *
 * API: Charts.render(format, placements, ascSign, opts)
 *   format      "south" | "north" | "east"
 *   placements  array[12] of arrays of short labels (e.g. ["Su","Mo"]) indexed by sign 0..11
 *   ascSign     sign index (0..11) of the ascendant, marked "La"
 *   opts.title  centre caption (e.g. "D1" / "D9")
 */
(function (global) {
  "use strict";

  var SIGN_ABBR = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"];
  var SIZE = 360;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Render planet labels centred at (cx,cy), wrapping to at most `perLine` per row.
  function labelBlock(labels, cx, cy, perLine) {
    if (!labels || !labels.length) return "";
    perLine = perLine || 3;
    var rows = [];
    for (var i = 0; i < labels.length; i += perLine) {
      rows.push(labels.slice(i, i + perLine).join(" "));
    }
    var lh = 13;
    var startY = cy - ((rows.length - 1) * lh) / 2;
    var out = "";
    for (var r = 0; r < rows.length; r++) {
      var cls = / La( |$)/.test(" " + rows[r] + " ") ? " has-lagna" : "";
      out += '<text class="planet' + cls + '" x="' + cx + '" y="' +
        (startY + r * lh) + '">' + esc(rows[r]) + '</text>';
    }
    return out;
  }

  function line(x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
  }

  // Build the label list for a sign, prefixing "La" in the ascendant sign.
  function labelsFor(placements, sign, ascSign) {
    var arr = (placements[sign] || []).slice();
    if (sign === ascSign) arr.unshift("La");
    return arr;
  }

  // ---- South Indian: fixed 4×4 grid, open centre --------------------------
  var SOUTH_CELL = {
    11: [0, 0], 0: [0, 1], 1: [0, 2], 2: [0, 3],
    10: [1, 0], 3: [1, 3],
    9: [2, 0], 4: [2, 3],
    8: [3, 0], 7: [3, 1], 6: [3, 2], 5: [3, 3]
  };

  function renderSouth(placements, ascSign, title) {
    var c = 90; // cell size
    var frame = '<rect class="frame" x="0" y="0" width="360" height="360"/>';
    // Full grid lines around the border ring, leaving the centre 2×2 open.
    frame += line(90, 0, 90, 360) + line(270, 0, 270, 360);
    frame += line(0, 90, 360, 90) + line(0, 270, 360, 270);
    frame += line(180, 0, 180, 90) + line(180, 270, 180, 360);
    frame += line(0, 180, 90, 180) + line(270, 180, 360, 180);
    var cells = "";
    for (var s = 0; s < 12; s++) {
      var rc = SOUTH_CELL[s];
      var x = rc[1] * c, y = rc[0] * c;
      cells += '<text class="sign" x="' + (x + 6) + '" y="' + (y + 15) + '">' +
        SIGN_ABBR[s] + '</text>';
      cells += labelBlock(labelsFor(placements, s, ascSign), x + c / 2, y + c / 2 + 4, 3);
    }
    var caption = '<text class="chart-title" x="180" y="185">' + esc(title || "") + '</text>';
    return svgWrap(frame + cells + caption);
  }

  // ---- North Indian: diamond, fixed houses (H1 = ascendant sign) -----------
  var NORTH_HOUSE = [
    [180, 60], [90, 30], [30, 90], [60, 180], [30, 270], [90, 330],
    [180, 300], [270, 330], [330, 270], [300, 180], [330, 90], [270, 30]
  ];

  function renderNorth(placements, ascSign, title) {
    var frame = '<rect class="frame" x="0" y="0" width="360" height="360"/>';
    frame += line(0, 0, 360, 360) + line(360, 0, 0, 360);           // diagonals
    frame += line(180, 0, 360, 180) + line(360, 180, 180, 360) +    // diamond
      line(180, 360, 0, 180) + line(0, 180, 180, 0);
    var body = "";
    for (var h = 0; h < 12; h++) {
      var sign = (ascSign + h) % 12;
      var pos = NORTH_HOUSE[h];
      body += '<text class="sign" x="' + pos[0] + '" y="' + (pos[1] - 12) + '">' +
        (sign + 1) + '</text>';
      body += labelBlock(labelsFor(placements, sign, ascSign), pos[0], pos[1] + 6, 3);
    }
    return svgWrap(frame + body);
  }

  // ---- East Indian: 3×3 frame, corners split diagonally (see Decisions #8) --
  // Fixed signs clockwise from the top-centre cell. [sign, cx, cy]
  var EAST_CELLS = [
    [0, 180, 55], [1, 285, 40], [2, 320, 80], [3, 300, 180], [4, 320, 285],
    [5, 285, 320], [6, 180, 305], [7, 75, 320], [8, 40, 285], [9, 60, 180],
    [10, 40, 75], [11, 75, 40]
  ];

  function renderEast(placements, ascSign, title) {
    var frame = '<rect class="frame" x="0" y="0" width="360" height="360"/>';
    frame += line(120, 0, 120, 360) + line(240, 0, 240, 360);
    frame += line(0, 120, 360, 120) + line(0, 240, 360, 240);
    frame += line(0, 0, 120, 120) + line(360, 0, 240, 120);         // corner diagonals
    frame += line(0, 360, 120, 240) + line(360, 360, 240, 240);
    var body = "";
    for (var i = 0; i < EAST_CELLS.length; i++) {
      var e = EAST_CELLS[i], s = e[0];
      body += '<text class="sign" x="' + e[1] + '" y="' + (e[2] - 16) + '">' +
        SIGN_ABBR[s] + '</text>';
      body += labelBlock(labelsFor(placements, s, ascSign), e[1], e[2] + 4, 2);
    }
    var caption = '<text class="chart-title" x="180" y="185">' + esc(title || "") + '</text>';
    return svgWrap(frame + body + caption);
  }

  // Styles are embedded inside the SVG so charts render identically whether shown inline
  // or rasterised for the PDF (where the page stylesheet is not available).
  var SVG_STYLE = '<style>' +
    '.frame{fill:none;stroke:#3a3a3a;stroke-width:1.3}' +
    'line{stroke:#3a3a3a;stroke-width:1.3}' +
    '.sign{fill:#b8791f;font:600 11px sans-serif;text-anchor:start}' +
    '.planet{fill:#1a1a1a;font:600 12.5px sans-serif;text-anchor:middle}' +
    '.planet.has-lagna{fill:#b23b3b}' +
    '.chart-title{fill:#999;font:600 14px sans-serif;text-anchor:middle}' +
    '</style>';

  function svgWrap(inner) {
    return '<svg class="chart" viewBox="0 0 ' + SIZE + ' ' + SIZE +
      '" xmlns="http://www.w3.org/2000/svg" role="img">' + SVG_STYLE + inner + '</svg>';
  }

  function render(format, placements, ascSign, opts) {
    opts = opts || {};
    if (format === "north") return renderNorth(placements, ascSign, opts.title);
    if (format === "east") return renderEast(placements, ascSign, opts.title);
    return renderSouth(placements, ascSign, opts.title);
  }

  // Map a UI chart-type label to an internal format key.
  function formatKey(chartType) {
    if (/north/i.test(chartType)) return "north";
    if (/east/i.test(chartType)) return "east";
    return "south";
  }

  global.Charts = { render: render, formatKey: formatKey };
})(typeof window !== "undefined" ? window : globalThis);
