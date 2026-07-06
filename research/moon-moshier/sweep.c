/*
 * sweep.c — measure the accuracy of the Moshier Moon vs. Swiss Ephemeris (DE431) longitude.
 *
 * Research tool for Shubharambham Horoscope (see ai-work-sessions/session-v0.3.1.md for the
 * plan this implements). NOT part of the shipped site — the site stays Moshier-only and
 * data-file-free; this study uses the .se1 files purely as the gold-standard reference.
 *
 * Method (Plan A, per the locked decisions in work-assignment/v0.3.1.txt):
 *   - Gold standard  = Swiss Ephemeris SWIEPH mode (semo_18.se1, a 0.001" compression of DE431).
 *   - Compared value = Moshier mode (SEFLG_MOSEPH), the analytic theory the site ships.
 *   - Quantity       = geocentric ecliptic LONGITUDE only, no nutation (SEFLG_NONUT on both).
 *   - Time grid      = every N minutes in UTC over [start_year, end_year).
 *   - UTC/TT         = both calls use swe_calc_ut, so sweph applies the SAME dT to each mode
 *                      and dT cancels exactly in the difference. Sampling in UTC is correct.
 *
 * Error per sample = |wrap180(lon_moshier - lon_swieph)| in arc-seconds.
 *
 * Outputs (to <out_prefix>*):
 *   - stdout / summary.json : run params, global max (grid + Brent-refined), mean, RMS,
 *                             percentiles, and threshold survival counts/percentages.
 *   - daily_max.csv         : one row per calendar day — the day's max error and the UTC
 *                             minute it occurred (the error envelope over the whole span).
 *   - maxima.csv            : the largest local maxima (Brent-refined), with Sun-Moon
 *                             elongation and Moon distance to expose the geometry of the peaks.
 *
 * Usage: ./sweep <ephe_path> <start_year> <end_year> <step_minutes> <out_prefix>
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <math.h>
#include "swephexp.h"

/* ---- error function: |Moshier - SWIEPH| Moon longitude, arc-seconds ---- */
static double moon_lon_err(double jd_ut) {
  double xm[6], xs[6];
  char serr[AS_MAXCH];
  int rm = swe_calc_ut(jd_ut, SE_MOON, SEFLG_MOSEPH | SEFLG_NONUT, xm, serr);
  if (rm < 0) { fprintf(stderr, "MOSEPH err @%.6f: %s\n", jd_ut, serr); exit(2); }
  int rs = swe_calc_ut(jd_ut, SE_MOON, SEFLG_SWIEPH | SEFLG_NONUT, xs, serr);
  if (rs < 0) { fprintf(stderr, "SWIEPH err @%.6f: %s\n", jd_ut, serr); exit(2); }
  double d = fmod(xm[0] - xs[0] + 180.0, 360.0);
  if (d < 0) d += 360.0;
  d -= 180.0;
  return fabs(d) * 3600.0;
}

/* ---- golden-section maximisation of moon_lon_err on [a,b] ---- */
static double golden_refine(double a, double b, double *out_err) {
  const double R = 0.6180339887498949, C = 1.0 - 0.6180339887498949;
  double x1 = b - R * (b - a), x2 = a + R * (b - a);
  double f1 = moon_lon_err(x1), f2 = moon_lon_err(x2);
  /* ~1e-6 day ~= 0.09 s; 60 iters is far more than enough */
  for (int i = 0; i < 60 && (b - a) > 1e-8; i++) {
    if (f1 > f2) { b = x2; x2 = x1; f2 = f1; x1 = b - R * (b - a); f1 = moon_lon_err(x1); }
    else        { a = x1; x1 = x2; f1 = f2; x2 = a + R * (b - a); f2 = moon_lon_err(x2); }
  }
  double xm = 0.5 * (a + b);
  *out_err = moon_lon_err(xm);
  return xm;
}

/* ---- a small top-N min-heap of local maxima, kept by error value ---- */
typedef struct { double jd, err; } Peak;
#define TOPN 300
static Peak topn[TOPN];
static int topn_len = 0;
static void topn_push(double jd, double err) {
  if (topn_len < TOPN) {
    int i = topn_len++;
    topn[i].jd = jd; topn[i].err = err;
    while (i > 0) { int p = (i - 1) / 2; if (topn[p].err <= topn[i].err) break;
      Peak t = topn[p]; topn[p] = topn[i]; topn[i] = t; i = p; }
  } else if (err > topn[0].err) {
    topn[0].jd = jd; topn[0].err = err;
    int i = 0;
    for (;;) { int l = 2*i+1, r = 2*i+2, s = i;
      if (l < TOPN && topn[l].err < topn[s].err) s = l;
      if (r < TOPN && topn[r].err < topn[s].err) s = r;
      if (s == i) break; Peak t = topn[s]; topn[s] = topn[i]; topn[i] = t; i = s; }
  }
}
static int peak_cmp(const void *a, const void *b) {
  double d = ((const Peak*)b)->err - ((const Peak*)a)->err;
  return (d > 0) - (d < 0);
}

int main(int argc, char **argv) {
  if (argc != 6) {
    fprintf(stderr, "usage: %s <ephe_path> <start_year> <end_year> <step_minutes> <out_prefix>\n", argv[0]);
    return 1;
  }
  const char *ephe = argv[1];
  int y0 = atoi(argv[2]), y1 = atoi(argv[3]);
  double step_min = atof(argv[4]);
  const char *prefix = argv[5];

  swe_set_ephe_path((char *)ephe);

  double jd0 = swe_julday(y0, 1, 1, 0.0, SE_GREG_CAL);
  double jd1 = swe_julday(y1, 1, 1, 0.0, SE_GREG_CAL);
  double step = step_min / 1440.0;
  long long N = (long long)llround((jd1 - jd0) / step);

  /* fine histogram: [0, HMAX) arcsec in BINW bins + overflow */
  const double BINW = 0.001, HMAX = 120.0;
  const int NBIN = (int)(HMAX / BINW);
  long long *hist = calloc(NBIN + 1, sizeof(long long)); /* last = overflow */

  const double THR[] = {1,2,5,10,30,60,90,120,180,300};
  const int NTHR = sizeof(THR)/sizeof(THR[0]);
  long long thr_cnt[16] = {0};

  double sum = 0.0, sumsq = 0.0, gmax = -1.0; long long gmax_i = 0;

  /* daily max: day index -> (err, jd) */
  int NDAY = (int)llround(jd1 - jd0) + 2;
  double *day_err = calloc(NDAY, sizeof(double));
  double *day_jd  = calloc(NDAY, sizeof(double));

  /* sliding window for local-maxima detection */
  double ep2 = -1, ep1 = -1, jp2 = 0, jp1 = 0;

  for (long long i = 0; i < N; i++) {
    double jd = jd0 + i * step;
    double e = moon_lon_err(jd);

    sum += e; sumsq += e * e;
    if (e > gmax) { gmax = e; gmax_i = i; }
    int b = (int)(e / BINW); if (b > NBIN) b = NBIN; hist[b]++;
    for (int t = 0; t < NTHR; t++) if (e > THR[t]) thr_cnt[t]++;

    int day = (int)((jd - jd0) + 1e-9);
    if (day >= 0 && day < NDAY && e > day_err[day]) { day_err[day] = e; day_jd[day] = jd; }

    /* local maximum at the middle sample of (ep2, ep1, e) */
    if (ep1 > ep2 && ep1 > e && ep1 > 0.05) topn_push(jp1, ep1);
    ep2 = ep1; jp2 = jp1; ep1 = e; jp1 = jd;

    if ((i & 0x3FFFFFF) == 0)
      fprintf(stderr, "\r%.1f%%  (%lld / %lld)  gmax=%.4f\"   ", 100.0*i/N, i, N, gmax);
  }
  fprintf(stderr, "\rdone %lld samples                              \n", N);

  /* Brent/golden refine the global max within +/- one step */
  double gmax_jd = jd0 + gmax_i * step, gmax_ref_err;
  double gmax_ref_jd = golden_refine(gmax_jd - step, gmax_jd + step, &gmax_ref_err);

  /* percentiles from the cumulative histogram */
  double pct_targets[] = {50,90,95,99,99.9,99.99};
  double pct_val[6];
  {
    long long cum = 0; int pi = 0;
    for (int b = 0; b <= NBIN && pi < 6; b++) {
      cum += hist[b];
      while (pi < 6 && (double)cum / N * 100.0 >= pct_targets[pi]) {
        pct_val[pi++] = (b + 0.5) * BINW;
      }
    }
    while (pi < 6) pct_val[pi++] = HMAX; /* saturated */
  }

  double mean = sum / N, rms = sqrt(sumsq / N);

  /* ---- partial.bin: additive state for merging parallel chunks ----
   * layout: int32 NBIN, NTHR; int64 N; f64 sum,sumsq,gmax,gmax_refined_err,gmax_refined_jd;
   *         int64 hist[NBIN+1]; int64 thr_cnt[NTHR]. */
  {
    char pf[512]; snprintf(pf, sizeof(pf), "%spartial.bin", prefix);
    FILE *pb = fopen(pf, "wb");
    int32_t nb = NBIN, nt = NTHR; fwrite(&nb, 4, 1, pb); fwrite(&nt, 4, 1, pb);
    fwrite(&N, 8, 1, pb);
    double sc[5] = {sum, sumsq, gmax, gmax_ref_err, gmax_ref_jd};
    fwrite(sc, 8, 5, pb);
    fwrite(hist, sizeof(long long), NBIN + 1, pb);
    fwrite(thr_cnt, sizeof(long long), NTHR, pb);
    fclose(pb);
  }

  /* utc of global max (grid + refined) */
  int gy, gmo, gd; double gut; swe_revjul(gmax_jd, SE_GREG_CAL, &gy, &gmo, &gd, &gut);
  int ry, rmo, rd; double rut; swe_revjul(gmax_ref_jd, SE_GREG_CAL, &ry, &rmo, &rd, &rut);
  int gh = (int)gut, gmin = (int)((gut-gh)*60), gsec=(int)((((gut-gh)*60)-gmin)*60);
  int rh = (int)rut, rmin = (int)((rut-rh)*60);
  double rsec = (((rut-rh)*60)-rmin)*60;

  /* ---- summary.json ---- */
  char fn[512];
  snprintf(fn, sizeof(fn), "%ssummary.json", prefix);
  FILE *f = fopen(fn, "w");
  fprintf(f, "{\n");
  fprintf(f, "  \"reference\": \"SWIEPH (DE431) vs MOSEPH, Moon ecliptic longitude, SEFLG_NONUT, geocentric\",\n");
  fprintf(f, "  \"range\": \"%d-01-01..%d-01-01 UTC\",\n", y0, y1);
  fprintf(f, "  \"step_minutes\": %g,\n", step_min);
  fprintf(f, "  \"samples\": %lld,\n", N);
  fprintf(f, "  \"units\": \"arcsec unless noted\",\n");
  fprintf(f, "  \"mean\": %.6f,\n  \"rms\": %.6f,\n", mean, rms);
  fprintf(f, "  \"max_grid\": {\"arcsec\": %.6f, \"utc\": \"%04d-%02d-%02d %02d:%02d:%02d\"},\n",
          gmax, gy, gmo, gd, gh, gmin, gsec);
  fprintf(f, "  \"max_refined\": {\"arcsec\": %.6f, \"arcmin\": %.6f, \"utc\": \"%04d-%02d-%02d %02d:%02d:%06.3f\"},\n",
          gmax_ref_err, gmax_ref_err/60.0, ry, rmo, rd, rh, rmin, rsec);
  fprintf(f, "  \"percentiles_arcsec\": {\"p50\": %.4f, \"p90\": %.4f, \"p95\": %.4f, \"p99\": %.4f, \"p99.9\": %.4f, \"p99.99\": %.4f},\n",
          pct_val[0], pct_val[1], pct_val[2], pct_val[3], pct_val[4], pct_val[5]);
  fprintf(f, "  \"survival\": [\n");
  for (int t = 0; t < NTHR; t++)
    fprintf(f, "    {\"gt_arcsec\": %g, \"gt_arcmin\": %g, \"count\": %lld, \"pct\": %.6f}%s\n",
            THR[t], THR[t]/60.0, thr_cnt[t], 100.0*thr_cnt[t]/N, t+1<NTHR?",":"");
  fprintf(f, "  ]\n}\n");
  fclose(f);

  /* ---- daily_max.csv ---- */
  snprintf(fn, sizeof(fn), "%sdaily_max.csv", prefix);
  f = fopen(fn, "w");
  fprintf(f, "date,max_err_arcsec,utc_of_max\n");
  for (int d = 0; d < NDAY; d++) {
    if (day_err[d] <= 0) continue;
    int yy, mm, dd; double ut; swe_revjul(day_jd[d], SE_GREG_CAL, &yy, &mm, &dd, &ut);
    int hh=(int)ut, mi=(int)((ut-hh)*60);
    fprintf(f, "%04d-%02d-%02d,%.5f,%02d:%02d\n", yy, mm, dd, day_err[d], hh, mi);
  }
  fclose(f);

  /* ---- maxima.csv (top-N local maxima, Brent-refined, with geometry) ---- */
  qsort(topn, topn_len, sizeof(Peak), peak_cmp);
  snprintf(fn, sizeof(fn), "%smaxima.csv", prefix);
  f = fopen(fn, "w");
  fprintf(f, "utc,err_arcsec,err_arcmin,sun_moon_elong_deg,moon_dist_au\n");
  for (int k = 0; k < topn_len; k++) {
    double err, jd = golden_refine(topn[k].jd - step, topn[k].jd + step, &err);
    double xm[6], xsun[6]; char serr[AS_MAXCH];
    swe_calc_ut(jd, SE_MOON, SEFLG_SWIEPH | SEFLG_NONUT, xm, serr);
    swe_calc_ut(jd, SE_SUN,  SEFLG_SWIEPH | SEFLG_NONUT, xsun, serr);
    double elong = fmod(xm[0] - xsun[0] + 360.0, 360.0);
    int yy, mm, dd; double ut; swe_revjul(jd, SE_GREG_CAL, &yy, &mm, &dd, &ut);
    int hh=(int)ut, mi=(int)((ut-hh)*60);
    fprintf(f, "%04d-%02d-%02d %02d:%02d,%.5f,%.5f,%.2f,%.6f\n",
            yy, mm, dd, hh, mi, err, err/60.0, elong, xm[2]);
  }
  fclose(f);

  printf("global max (refined): %.5f arcsec = %.5f arcmin at %04d-%02d-%02d %02d:%02d:%06.3f UTC\n",
         gmax_ref_err, gmax_ref_err/60.0, ry, rmo, rd, rh, rmin, rsec);
  printf("mean=%.4f\" rms=%.4f\" p99=%.4f\" p99.99=%.4f\"\n", mean, rms, pct_val[3], pct_val[5]);
  printf("wrote %ssummary.json, %sdaily_max.csv, %smaxima.csv\n", prefix, prefix, prefix);

  free(hist); free(day_err); free(day_jd);
  swe_close();
  return 0;
}
