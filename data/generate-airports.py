#!/usr/bin/env python3
"""
Generates data/airports.json from the OurAirports dataset.

To refresh:
    python3 data/generate-airports.py

Source: https://ourairports.com/data/ (airports.csv + countries.csv, public domain)
Only rows with a valid 3-letter IATA code are kept, and only the IATA
code, city, and country fields are retained (all other OurAirports
columns, e.g. coordinates, elevation, airport type, are dropped).
"""

import csv
import json
import re
import urllib.request
from pathlib import Path

AIRPORTS_URL = "https://ourairports.com/data/airports.csv"
COUNTRIES_URL = "https://ourairports.com/data/countries.csv"
OUTPUT_PATH = Path(__file__).parent / "airports.json"
IATA_RE = re.compile(r"^[A-Z]{3}$")
UNKNOWN_CITY = "Unknown"


def fetch_rows(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        text = response.read().decode("utf-8")
    return csv.DictReader(text.splitlines())


def build_country_names(rows):
    return {row["code"]: row["name"] for row in rows}


def build_airports(rows, country_names):
    airports = {}
    for row in rows:
        iata = row["iata_code"].strip()
        if not IATA_RE.match(iata):
            continue
        country_code = row["iso_country"].strip()
        airports[iata] = {
            "city": row["municipality"].strip() or UNKNOWN_CITY,
            "country": country_names.get(country_code, country_code),
        }
    return airports


def main():
    country_names = build_country_names(fetch_rows(COUNTRIES_URL))
    airports = build_airports(fetch_rows(AIRPORTS_URL), country_names)
    sorted_airports = {code: airports[code] for code in sorted(airports)}
    OUTPUT_PATH.write_text(
        json.dumps(sorted_airports, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(sorted_airports)} airports to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
