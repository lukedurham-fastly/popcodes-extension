// Fetches the current Fastly POP list and writes data/pops.json.
//
// Dev-only tooling, run at package time (see scripts/build.mjs) — the shipped
// extension never fetches this itself. Requires a FASTLY_API_TOKEN env var;
// the token is read from the environment only, never stored here.
//
// Output is keyed by POP code, trimmed to what the popup needs (matching the
// dataset-minimalism convention):
//   { "AMS": { "name": "Amsterdam", "latitude": 52.3, "longitude": 4.7, "metro": false }, ... }
// Metro POPs carry a "(Metro)" suffix on the API's name field; the suffix is
// stripped and recorded as the boolean `metro` flag instead.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const token = process.env.FASTLY_API_TOKEN;
if (!token) {
  console.error(
    "error: FASTLY_API_TOKEN environment variable is not set — it is required to fetch the Fastly POP list"
  );
  process.exit(1);
}

const response = await fetch("https://api.fastly.com/datacenters", {
  headers: { "Fastly-Key": token, Accept: "application/json" },
});

if (!response.ok) {
  console.error(
    `error: Fastly datacenters API request failed: ${response.status} ${response.statusText}`
  );
  process.exit(1);
}

const datacenters = await response.json();

const METRO_SUFFIX = " (Metro)";
const pops = {};

for (const dc of datacenters) {
  const metro = dc.name.endsWith(METRO_SUFFIX);
  pops[dc.code] = {
    name: metro ? dc.name.slice(0, -METRO_SUFFIX.length) : dc.name,
    latitude: dc.coordinates.latitude,
    longitude: dc.coordinates.longitude,
    metro,
  };
}

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "pops.json"
);
writeFileSync(outPath, JSON.stringify(pops, null, 2) + "\n");
console.log(`wrote ${Object.keys(pops).length} POPs to data/pops.json`);
