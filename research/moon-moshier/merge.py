#!/usr/bin/env python3
"""Merge the partial.bin files from parallel sweep chunks into final statistics.

Usage: merge.py <out_dir> <chunk_prefix1> <chunk_prefix2> ...
Each <prefixN>partial.bin holds additive state (histogram, counters, sums, chunk max).
Reads the per-chunk daily_max.csv / maxima.csv too, concatenates, and writes merged
daily_max.csv, maxima.csv and summary.json into <out_dir>.
"""
import sys, os, json, struct, glob
import numpy as np

BINW = 0.001  # arcsec per histogram bin (must match sweep.c)

def read_partial(path):
    with open(path, "rb") as f:
        nb, nt = struct.unpack("<ii", f.read(8))
        (N,) = struct.unpack("<q", f.read(8))
        sc = struct.unpack("<5d", f.read(40))  # sum, sumsq, gmax, gmax_ref_err, gmax_ref_jd
        hist = np.frombuffer(f.read(8 * (nb + 1)), dtype="<i8").copy()
        thr = np.frombuffer(f.read(8 * nt), dtype="<i8").copy()
    return dict(nb=nb, nt=nt, N=N, sum=sc[0], sumsq=sc[1], gmax=sc[2],
                gmax_ref_err=sc[3], gmax_ref_jd=sc[4], hist=hist, thr=thr)

def jd_to_utc(jd):
    # inverse Julian day (Gregorian), returns "YYYY-MM-DD HH:MM:SS.sss"
    jd += 0.5
    Z = int(jd); F = jd - Z
    A = Z
    if Z >= 2299161:
        alpha = int((Z - 1867216.25) / 36524.25)
        A = Z + 1 + alpha - alpha // 4
    B = A + 1524; C = int((B - 122.1) / 365.25); D = int(365.25 * C)
    E = int((B - D) / 30.6001)
    day = B - D - int(30.6001 * E) + F
    month = E - 1 if E < 14 else E - 13
    year = C - 4716 if month > 2 else C - 4715
    d = int(day); frac = day - d
    hh = int(frac * 24); mm = int((frac * 24 - hh) * 60)
    ss = (((frac * 24 - hh) * 60) - mm) * 60
    return f"{year:04d}-{month:02d}-{d:02d} {hh:02d}:{mm:02d}:{ss:06.3f}"

def main():
    out_dir = sys.argv[1]
    prefixes = sys.argv[2:]
    os.makedirs(out_dir, exist_ok=True)

    parts = [read_partial(p + "partial.bin") for p in prefixes]
    nb, nt = parts[0]["nb"], parts[0]["nt"]
    N = sum(p["N"] for p in parts)
    tot = sum(p["sum"] for p in parts)
    totsq = sum(p["sumsq"] for p in parts)
    hist = np.zeros(nb + 1, dtype="i8")
    thr = np.zeros(nt, dtype="i8")
    for p in parts:
        hist += p["hist"]; thr += p["thr"]

    mean = tot / N
    rms = (totsq / N) ** 0.5

    # global max = the largest per-chunk refined max
    best = max(parts, key=lambda p: p["gmax_ref_err"])

    # percentiles from cumulative histogram
    cum = np.cumsum(hist)
    def pct(pp):
        target = pp / 100.0 * N
        b = int(np.searchsorted(cum, target))
        return (b + 0.5) * BINW
    percentiles = {f"p{p}": round(pct(p), 4) for p in (50, 90, 95, 99, 99.9, 99.99)}

    THR = [1, 2, 5, 10, 30, 60, 90, 120, 180, 300]
    survival = [dict(gt_arcsec=THR[t], gt_arcmin=THR[t] / 60.0,
                     count=int(thr[t]), pct=100.0 * thr[t] / N) for t in range(nt)]

    summary = dict(
        reference="SWIEPH (DE431) vs MOSEPH, Moon ecliptic longitude, SEFLG_NONUT, geocentric",
        step_minutes=1, samples=int(N), units="arcsec unless noted",
        mean=round(mean, 6), rms=round(rms, 6),
        max_refined=dict(arcsec=round(best["gmax_ref_err"], 6),
                         arcmin=round(best["gmax_ref_err"] / 60.0, 6),
                         utc=jd_to_utc(best["gmax_ref_jd"])),
        percentiles_arcsec=percentiles, survival=survival)
    with open(os.path.join(out_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # merge daily_max.csv (disjoint days) and maxima.csv (concat, keep top 300)
    with open(os.path.join(out_dir, "daily_max.csv"), "w") as out:
        out.write("date,max_err_arcsec,utc_of_max\n")
        for p in prefixes:
            fn = p + "daily_max.csv"
            if os.path.exists(fn):
                with open(fn) as g:
                    next(g); out.writelines(g)

    rows = []
    for p in prefixes:
        fn = p + "maxima.csv"
        if os.path.exists(fn):
            with open(fn) as g:
                next(g)
                for line in g:
                    parts_ = line.strip().split(",")
                    if len(parts_) == 5:
                        rows.append(parts_)
    rows.sort(key=lambda r: float(r[1]), reverse=True)
    with open(os.path.join(out_dir, "maxima.csv"), "w") as out:
        out.write("utc,err_arcsec,err_arcmin,sun_moon_elong_deg,moon_dist_au\n")
        for r in rows[:300]:
            out.write(",".join(r) + "\n")

    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
