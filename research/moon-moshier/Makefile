# Build the Moshier-vs-SWIEPH Moon-longitude sweep.
#
# Needs the Swiss Ephemeris C sources. Point SWEPH_SRC at a checkout of
# github.com/aloistr/swisseph (see ./fetch-sweph.sh), e.g.:
#
#   make SWEPH_SRC=./swisseph
#   ./sweep ../ephe 1950 2100 1 out/
#
# The .se1 reference files live in ../ephe (semo_18.se1, sepl_18.se1), committed with the repo.

SWEPH_SRC ?= ./swisseph
CC        ?= gcc
CFLAGS    ?= -O3 -march=native -Wall -I$(SWEPH_SRC)

# The Swiss Ephemeris translation units needed for swe_calc_ut / swe_houses / dates.
SWE_SRC = $(SWEPH_SRC)/swedate.c $(SWEPH_SRC)/swehouse.c $(SWEPH_SRC)/swejpl.c \
          $(SWEPH_SRC)/swemmoon.c $(SWEPH_SRC)/swemplan.c $(SWEPH_SRC)/sweph.c \
          $(SWEPH_SRC)/swephlib.c $(SWEPH_SRC)/swecl.c $(SWEPH_SRC)/swehel.c

sweep: sweep.c $(SWE_SRC)
	$(CC) $(CFLAGS) -o $@ sweep.c $(SWE_SRC) -lm

clean:
	rm -f sweep

.PHONY: clean
