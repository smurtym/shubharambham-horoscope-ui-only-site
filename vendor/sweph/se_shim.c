/*
 * se_shim.c — thin C entry point over Swiss Ephemeris for the Shubharambham WASM build.
 *
 * One function, se_compute(), fills a flat double array with everything the Jyotish layer
 * needs, so the JS glue never has to juggle multiple sweph calls or their buffers.
 *
 * Runs in Moshier mode (SEFLG_MOSHIER): Swiss Ephemeris's built-in analytical theory,
 * which needs NO .se1 data files — essential for a static, offline, file:// site.
 */
#include "swephexp.h"
#include <emscripten.h>

/*
 * Compute a full set of tropical positions for an instant & location.
 *   tjd_ut         Julian day, Universal Time.
 *   geolat, geolon observer geographic degrees (North +, East +).
 *   out            caller-allocated array of at least 13 doubles, filled as:
 *                    [0] Sun     [1] Moon    [2] Mars    [3] Mercury  [4] Jupiter
 *                    [5] Venus   [6] Saturn  [7] Uranus  [8] Neptune
 *                    [9] Rahu (mean lunar node, tropical)
 *                    [10] ayanamsa (True Chitrapaksha)
 *                    [11] ascendant (tropical, of date)
 *                    [12] true obliquity of the ecliptic (of date)
 *   serr           caller-allocated char buffer (>= 256) for any error message.
 * Longitudes are apparent geocentric tropical ecliptic of date, degrees [0,360).
 * Returns 0 on success, -1 on error (serr holds the message).
 */
EMSCRIPTEN_KEEPALIVE
int se_compute(double tjd_ut, double geolat, double geolon, double *out, char *serr) {
  int32 iflag = SEFLG_MOSEPH | SEFLG_SPEED;
  double xx[6];
  /* Swiss Ephemeris body numbers, in the order the site displays the grahas. */
  int idx[9] = { SE_SUN, SE_MOON, SE_MARS, SE_MERCURY, SE_JUPITER,
                 SE_VENUS, SE_SATURN, SE_URANUS, SE_NEPTUNE };
  int i;

  serr[0] = '\0';

  for (i = 0; i < 9; i++) {
    if (swe_calc_ut(tjd_ut, idx[i], iflag, xx, serr) < 0) return -1;
    out[i] = xx[0];
  }

  /* Rahu = mean lunar node (decision: mean, matching v0.1.0). Ketu derived in JS. */
  if (swe_calc_ut(tjd_ut, SE_MEAN_NODE, iflag, xx, serr) < 0) return -1;
  out[9] = xx[0];

  /* Ayanamsa: True Chitrapaksha (SE_SIDM_TRUE_CITRA), matching v0.1.0 decision #2. */
  swe_set_sid_mode(SE_SIDM_TRUE_CITRA, 0, 0);
  {
    double daya;
    if (swe_get_ayanamsa_ex_ut(tjd_ut, iflag, &daya, serr) < 0) return -1;
    out[10] = daya;
  }

  /* Ascendant: tropical of date. House system is irrelevant to ascmc[0]; use Placidus. */
  {
    double cusps[13], ascmc[10];
    if (swe_houses(tjd_ut, geolat, geolon, 'P', cusps, ascmc) < 0) return -1;
    out[11] = ascmc[0];
  }

  /* True obliquity of date (SE_ECL_NUT: xx[0]=true eps, xx[1]=mean eps, xx[2..3]=nut). */
  {
    double xnut[6];
    if (swe_calc_ut(tjd_ut, SE_ECL_NUT, 0, xnut, serr) < 0) return -1;
    out[12] = xnut[0];
  }

  return 0;
}
