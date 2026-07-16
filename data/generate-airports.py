#!/usr/bin/env python3
"""
Generates data/airports.json from the OpenFlights airports dataset.

To refresh:
    python3 data/generate-airports.py

Source: https://github.com/jpatokal/openflights (data/airports.dat, CC BY-SA 4.0)
Only rows with a valid 3-letter IATA code are kept, and only the IATA
code, city, and country fields are retained (all other OpenFlights
columns, e.g. coordinates, altitude, timezone, are dropped).
"""

import csv
import json
import re
import urllib.request
from pathlib import Path

SOURCE_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
OUTPUT_PATH = Path(__file__).parent / "airports.json"
IATA_RE = re.compile(r"^[A-Z]{3}$")

# OpenFlights airports.dat column order (no header row).
COL_CITY = 2
COL_COUNTRY = 3
COL_IATA = 4


def fetch_rows():
    with urllib.request.urlopen(SOURCE_URL) as response:
        text = response.read().decode("utf-8")
    return csv.reader(text.splitlines())


def build_airports(rows):
    airports = {}
    for row in rows:
        if len(row) <= COL_IATA:
            continue
        iata = row[COL_IATA].strip()
        if not IATA_RE.match(iata):
            continue
        airports[iata] = {
            "city": row[COL_CITY].strip(),
            "country": row[COL_COUNTRY].strip(),
        }
    return airports


def main():
    airports = build_airports(fetch_rows())
    sorted_airports = {code: airports[code] for code in sorted(airports)}
    OUTPUT_PATH.write_text(
        json.dumps(sorted_airports, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(sorted_airports)} airports to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
