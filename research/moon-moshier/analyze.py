#!/usr/bin/env python3
"""Report + plot the Moshier-vs-SWIEPH Moon-longitude error study.

Reads <merged_dir>/summary.json, daily_max.csv, maxima.csv and:
  - prints a human-readable report,
  - writes envelope.svg: daily-max error (arcsec) over 1950-2100 (dependency-free SVG).

Usage: analyze.py <merged_dir>
"""
import sys, os, json, csv
from datetime import date

def main():
    d = sys.argv[1]
    summary = json.load(open(os.path.join(d, "summary.json")))

    # ---- report ----
    print("=" * 72)
    print("Moshier Moon longitude error vs Swiss Ephemeris (DE431), 1950-2100")
    print("=" * 72)
    print(f"samples (1/min): {summary['samples']:,}")
    print(f"mean = {summary['mean']:.4f}\"   rms = {summary['rms']:.4f}\"")
    mr = summary["max_refined"]
    print(f"GLOBAL MAX = {mr['arcsec']:.4f}\" = {mr['arcmin']:.5f}'  at {mr['utc']} UTC")
    print("\npercentiles (arcsec):")
    for k, v in summary["percentiles_arcsec"].items():
        print(f"  {k:>7}: {v:.4f}\"")
    print("\n% of the 1950-2100 timeline with error greater than threshold:")
    for s in summary["survival"]:
        print(f"  > {s['gt_arcsec']:>3g}\" ({s['gt_arcmin']:.4f}') : {s['pct']:.4f}%   ({s['count']:,})")

    # ---- envelope.svg from daily_max.csv ----
    days, errs = [], []
    with open(os.path.join(d, "daily_max.csv")) as f:
        for row in csv.DictReader(f):
            y, m, dd = map(int, row["date"].split("-"))
            days.append(date(y, m, dd).toordinal())
            errs.append(float(row["max_err_arcsec"]))
    if days:
        write_svg(os.path.join(d, "envelope.svg"), days, errs)
        print(f"\nwrote {os.path.join(d, 'envelope.svg')} ({len(days)} daily points)")

def write_svg(path, xs, ys, W=1000, H=360, pad=54):
    x0, x1 = min(xs), max(xs)
    y1 = max(ys) * 1.08
    def sx(x): return pad + (x - x0) / (x1 - x0) * (W - 2 * pad)
    def sy(y): return H - pad - y / y1 * (H - 2 * pad)
    pts = " ".join(f"{sx(x):.1f},{sy(y):.1f}" for x, y in zip(xs, ys))
    # y gridlines every whole arcsec
    grid = []
    yy = 0
    while yy <= y1:
        gy = sy(yy)
        grid.append(f'<line x1="{pad}" y1="{gy:.1f}" x2="{W-pad}" y2="{gy:.1f}" stroke="#e5e5e5"/>')
        grid.append(f'<text x="{pad-8}" y="{gy+4:.1f}" text-anchor="end" font-size="11" fill="#666">{yy}"</text>')
        yy += 1
    # x labels every 25 years
    xlab = []
    for yr in range(1950, 2101, 25):
        gx = sx(date(yr, 1, 1).toordinal())
        xlab.append(f'<line x1="{gx:.1f}" y1="{H-pad}" x2="{gx:.1f}" y2="{H-pad+5}" stroke="#666"/>')
        xlab.append(f'<text x="{gx:.1f}" y="{H-pad+20}" text-anchor="middle" font-size="11" fill="#666">{yr}</text>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="sans-serif">
<rect width="{W}" height="{H}" fill="white"/>
<text x="{W/2}" y="24" text-anchor="middle" font-size="15" fill="#222">Moshier Moon longitude error (daily maximum), 1950-2100 &#8212; vs Swiss Ephemeris DE431</text>
{''.join(grid)}
<polyline fill="none" stroke="#c0392b" stroke-width="0.7" points="{pts}"/>
{''.join(xlab)}
<text x="16" y="{H/2}" transform="rotate(-90 16 {H/2})" text-anchor="middle" font-size="12" fill="#444">error (arc-seconds)</text>
</svg>'''
    open(path, "w").write(svg)

if __name__ == "__main__":
    main()
