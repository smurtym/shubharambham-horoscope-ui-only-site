#!/usr/bin/env bash
# Reproduce vendor/sweph/sweph.js from the official Swiss Ephemeris sources.
#
# Requires Emscripten (emcc) on PATH. Produces a single self-contained sweph.js with the
# WASM binary inlined as base64 (SINGLE_FILE=1) so the site keeps working from file:// with
# no network fetch. Runs in Moshier mode (SEFLG_MOSEPH) — no .se1 data files needed.
#
# Usage:
#   git clone --depth 1 https://github.com/aloistr/swisseph.git
#   cp se_shim.c swisseph/ && cd swisseph
#   bash /path/to/build.sh
#
# Pinned build: Swiss Ephemeris 2.10.03, Emscripten 4.0.13.
set -euo pipefail

emcc -O3 \
  se_shim.c swedate.c swehouse.c swejpl.c swemmoon.c swemplan.c sweph.c swephlib.c swecl.c swehel.c \
  -o sweph.js \
  -s MODULARIZE=1 -s EXPORT_NAME=SwephModule \
  -s ENVIRONMENT=web,worker \
  -s SINGLE_FILE=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s "EXPORTED_FUNCTIONS=['_se_compute','_se_sun_trop','_swe_close','_swe_version','_malloc','_free']" \
  -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','UTF8ToString','HEAPF64']"

echo "Built sweph.js ($(wc -c < sweph.js) bytes). Copy it to vendor/sweph/."
