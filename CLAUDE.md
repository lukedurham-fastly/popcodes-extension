# popcodes-extension

Browser extension for looking up IATA airport codes locally (no network calls). Click toolbar icon, type a 3-letter code, see city/country. Keeps last 5 lookups.

## Architecture

- Manifest V3, target browsers: Chrome, Edge, Firefox (no Safari).
- Vanilla HTML/CSS/JS — no framework, no build tooling initially.
- Bundled JSON dataset (`data/airports.json`) — everything runs locally, no API calls, no host_permissions.
- Folder structure: `/src` (popup.html, popup.js, popup.css), `/data`, `/icons`.

## Conventions

- Use `browser.*` WebExtension APIs (via `webextension-polyfill`), not `chrome.*`, once the polyfill is added — see the cross-browser ticket.
- Normalize airport code input to uppercase before lookup; input is case-insensitive.
- Keep the popup small (~300px wide).
- No network requests anywhere in this extension — lookups must stay fully local.
- Airport dataset keeps only IATA code, city, country, and ICAO code (when valid) — no unused fields from the source data.
- A POP's "internal code" (shown as the `Internal:` badge) is its Grafana site code(s), read from `data/site-codes.json` (generated, see "Reconciling internal site codes"); only POPs absent from that file fall back to the airport's ICAO. Never hand-edit `site-codes.json`.
- Brand color is Fastly red `#FF282D` — use it for icons and any branded UI accents. Icon sources of truth are `icons/icon.svg` (48/128px PNGs) and `icons/icon-small.svg` (16/32px PNGs — simplified red plane on transparent for toolbar legibility); re-render the PNGs from them rather than editing them directly.

## Testing

- End-to-end tests live in `/test` and use Playwright to drive the real unpacked extension in Chromium (not a mock DOM) — see README for setup.
- Run `npm run test:e2e` after any change to `src/popup.js` or `src/popup.html`, and before handing off a ticket that touches popup behavior.
- The extension has no background service worker, so tests launch Chromium headed (not headless) and compute the extension ID from the load path (`crypto.createHash("sha256")` of the absolute path, same as Chromium's unpacked-extension ID derivation) rather than waiting on a service worker event.
- This is dev-only tooling (Node + Playwright as devDependencies) — it doesn't change the "no build tooling initially" rule for the shipped extension itself, which stays framework-free and build-free.

## Reconciling internal site codes

The airport ICAO code is often not what Grafana uses (e.g. IXD's ICAO is VEAB but its site code is `IXD`; QAV/QAL/QAA have no airport record at all but sites VIAM/VICG/VISP). To refresh:

1. Get a fresh Grafana cache-node export (`fastly-cache-nodes-summary.toml`: region -> POP -> site set -> nodes). Each site-set key is a site code; keys with no site token in the hostname default to the POP code, and `QAB-VEBS`-style keys keep only the part after the dash.
2. Run `python3 data/generate-site-codes.py fastly-cache-nodes-summary.toml` to regenerate `data/site-codes.json`.
3. Verify with the Grafana MCP (don't page through dashboards — these three calls cover everything):
   - `list_datasources` (type `prometheus`, limit 100, offsets 0/100/200): datasource names are `<site-code><n>` (`kbfi740`, `visp441`, `vicg435`); strip the trailing digits.
   - `list_prometheus_label_values` on the `global` datasource (uid `000000005`), `labelName: datacenter`, `matches: [{filters:[{name:"datacenter",type:"=~",value:"[A-Z0-9-]{3,8}"}]}]`, `startRfc3339: now-24h`, `limit: 1000`: the live site/POP codes. (`fastly_com_datacenter` is a narrower, US/EU-skewed subset.)
   - Spot-check a single POP by adding a name to the regex, e.g. `(?i)ixd|veab`.
4. Put the codes from steps 3 in a text file and pass it as `--grafana codes.txt`; the script lists site codes it can't find. Expect some unmatched ICAO site codes (many India Q-POPs have no datasource) — these come from the node export, so treat them as unverified rather than wrong.
5. Run `npm run test:e2e`; update the test fixture POPs if you add a test for a new code.

Gotchas: the TOML trims each site set to 5 sample nodes; `TSS` hostnames say `kjra` but the Grafana site is `TSS`; metros (CHI, NYC, LON, PAR) list their constituent airports' site codes.

## Work tracking

Work is tracked as GitHub issues in this repo, one per ticket. Each issue lists its goal, agent instructions, and dependencies (other issue numbers). Check an issue's dependencies are closed before starting it. See the README for the full ticket list and current issue numbers.

Not in scope yet: store listing/publishing (Chrome Web Store, AMO, Edge Add-ons) — side-loading only for now.

## Ticketing
When creating or editing a ticket, do NOT add custom TICKET IDs, like TICKET-11 - DO NOT DO THIS - just use the github issue number, such as Issue #12.

## Implementing a ticket

When asked to implement a ticket (GitHub issue):

1. Check the issue's dependencies are closed before starting.
2. Fetch the latest `main` and branch from it, named `<issue-number>-<short-slug>` (e.g. `12-uppercase-normalize`).
3. Check out the new branch.
4. Push the branch to `origin` and comment on the issue linking to it (e.g. "Working on this in branch `12-uppercase-normalize`").
5. Implement the changes described in the issue.
6. If the change touches popup behavior, run `npm run test:e2e` (see Testing above) and fix any failures before handing off.
7. Do not commit. Instead, provide a short commit message in the response that can be manually copied into the commit.

