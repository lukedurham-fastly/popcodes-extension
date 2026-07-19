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
- Brand color is Fastly red `#FF282D` — use it for icons and any branded UI accents. Icon source of truth is `icons/icon.svg`; re-render the PNGs from it rather than editing them directly.

## Testing

- End-to-end tests live in `/test` and use Playwright to drive the real unpacked extension in Chromium (not a mock DOM) — see README for setup.
- Run `npm run test:e2e` after any change to `src/popup.js` or `src/popup.html`, and before handing off a ticket that touches popup behavior.
- The extension has no background service worker, so tests launch Chromium headed (not headless) and compute the extension ID from the load path (`crypto.createHash("sha256")` of the absolute path, same as Chromium's unpacked-extension ID derivation) rather than waiting on a service worker event.
- This is dev-only tooling (Node + Playwright as devDependencies) — it doesn't change the "no build tooling initially" rule for the shipped extension itself, which stays framework-free and build-free.

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

