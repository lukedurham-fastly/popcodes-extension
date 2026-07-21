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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(rootDir, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

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

const dataDir = join(rootDir, "data");
const airports = JSON.parse(readFileSync(join(dataDir, "airports.json"), "utf8"));
const metroCodes = JSON.parse(readFileSync(join(dataDir, "metro-codes.json"), "utf8"));
const fastlyCodes = JSON.parse(readFileSync(join(dataDir, "fastly-codes.json"), "utf8"));
const knownCodes = { ...airports, ...metroCodes, ...fastlyCodes };

const METRO_SUFFIX = " (Metro)";
const pops = {};

for (const dc of datacenters) {
  const metro = dc.name.endsWith(METRO_SUFFIX);
  const name = metro ? dc.name.slice(0, -METRO_SUFFIX.length) : dc.name;
  pops[dc.code] = {
    name,
    latitude: dc.coordinates.latitude,
    longitude: dc.coordinates.longitude,
    metro,
  };

  // Some POPs use codes that aren't in the master airport dataset: interim
  // IATA codes for airports not yet added (e.g. WSI, Western Sydney
  // International), IATA metro codes (data/metro-codes.json), or
  // Fastly-internal placeholders for cities with no IATA code at all
  // (data/fastly-codes.json). Warn on whatever's left after checking all
  // three, but don't fail the build — the popup simply won't match them.
  // billing_region is the API's closest field to a country (it's a continent
  // for regions Fastly doesn't bill per-country).
  if (!(dc.code in knownCodes)) {
    console.warn(
      `warning: POP ${dc.code} (${name}, ${dc.billing_region}) is not in data/airports.json, data/metro-codes.json, or data/fastly-codes.json — possibly an interim airport code`
    );
  }
}

const outPath = join(dataDir, "pops.json");
writeFileSync(outPath, JSON.stringify(pops, null, 2) + "\n");
console.log(`wrote ${Object.keys(pops).length} POPs to data/pops.json`);
