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
- Airport dataset keeps only IATA code, city, country — no unused fields from the source data.

## Work tracking

Work is tracked as GitHub issues in this repo, one per ticket. Each issue lists its goal, agent instructions, and dependencies (other issue numbers). Check an issue's dependencies are closed before starting it. See the README for the full ticket list and current issue numbers.

Not in scope yet: store listing/publishing (Chrome Web Store, AMO, Edge Add-ons) — side-loading only for now.
