#!/usr/bin/env bash
# Fetch the official Swiss Ephemeris C sources needed to build sweep.c.
# Pinned to the same release the site uses (2.10.03). Clones into ./swisseph.
set -euo pipefail
cd "$(dirname "$0")"
if [ -d swisseph ]; then echo "swisseph/ already present"; exit 0; fi
git clone --depth 1 https://github.com/aloistr/swisseph.git swisseph
echo "Done. Now: make SWEPH_SRC=./swisseph && ./sweep ../ephe 1950 2100 1 out/"
