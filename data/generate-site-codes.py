#!/usr/bin/env python3
"""
Generates data/site-codes.json: POP code -> Grafana site code(s).

To refresh:
    python3 data/generate-site-codes.py fastly-cache-nodes-summary.toml [--grafana codes.txt]

The input is the cache node summary exported from Grafana (Region -> POP ->
site set -> nodes). A site set's key is the site code that Grafana uses for
those nodes (usually the ICAO code from the hostname, or the POP code itself
when hostnames carry no site code). Keys like "QAB-VEBS" are split to keep
the site part only.

--grafana is an optional whitespace-separated file of known Grafana codes
(the `datacenter` label values on the `global` datasource plus datasource
names with trailing digits stripped; see CLAUDE.md). Site codes missing from
it are reported on stderr so they can be checked by hand.
"""

import json
import sys
import tomllib
from pathlib import Path

OUTPUT_PATH = Path(__file__).parent / "site-codes.json"
NON_POP_TABLES = {"meta", "missing_pops"}


def build_site_codes(summary):
    site_codes = {}
    for region, pops in summary.items():
        if region in NON_POP_TABLES:
            continue
        for pop, pop_table in pops.items():
            if not isinstance(pop_table, dict) or "location" not in pop_table:
                continue
            sets = {k: v for k, v in pop_table.items() if isinstance(v, dict)}
            ordered = sorted(sets, key=lambda k: (-sets[k]["node_count"], k))
            codes = [key.split("-")[-1] for key in ordered]
            site_codes[pop.upper()] = list(dict.fromkeys(codes))
    return dict(sorted(site_codes.items()))


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    summary = tomllib.loads(Path(args[0]).read_text())
    site_codes = build_site_codes(summary)
    OUTPUT_PATH.write_text(json.dumps(site_codes, indent=2) + "\n")
    print(f"wrote {len(site_codes)} POPs to {OUTPUT_PATH}")

    if "--grafana" in args:
        known = set(Path(args[args.index("--grafana") + 1]).read_text().upper().split())
        for pop, codes in site_codes.items():
            unknown = [c for c in codes if c not in known]
            if unknown:
                print(f"not in Grafana: {pop} {unknown}", file=sys.stderr)


if __name__ == "__main__":
    main()
