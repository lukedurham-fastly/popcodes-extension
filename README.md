# popcodes-extension

A lightweight browser extension for looking up IATA airport codes. Click the toolbar icon, type a 3-letter code (e.g. SYD), and the popup shows the matching city and country. The last 5 lookups are kept in a small recent-history list for quick re-reference. Everything runs locally — no API calls, no network dependency — backed by a bundled airport code dataset.

Target browsers: Chrome, Edge, Firefox (Manifest V3, no Safari).

Architecture: vanilla HTML/CSS/JS, no framework, bundled JSON dataset, no network calls.

## Branding

Icons and branding use Fastly red `#FF282D` as the primary brand color. The icon sources are `icons/icon.svg` (48/128px PNGs) and `icons/icon-small.svg` (16/32px PNGs — simplified red plane on transparent for toolbar legibility); the PNG sizes referenced in the manifest are rendered from them.

## Packaging

Build a distributable package for each target browser:

```
npm run build
```

This produces `dist/chrome`, `dist/edge`, and `dist/firefox` (plus a zip of each, e.g. `dist/popcodes-firefox-0.1.0.zip`). Chrome and Edge share a manifest; the Firefox variant keeps the `browser_specific_settings.gecko` keys. The dev-only dataset generator (`data/generate-airports.py`) is excluded from packages.

## Testing

End-to-end tests drive the real unpacked extension in Chromium via Playwright.

Install dependencies once:

```
brew install node        # if you don't already have Node.js
npm install
npx playwright install chromium
```

Run the tests:

```
npm run test:e2e
```

The suite runs Chromium in headed mode (a browser window will briefly appear) — this extension has no background service worker, so headless mode isn't used here.

