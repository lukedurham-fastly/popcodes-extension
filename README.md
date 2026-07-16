# popcodes-extension

A lightweight browser extension for looking up IATA airport codes. Click the toolbar icon, type a 3-letter code (e.g. SYD), and the popup shows the matching city and country. The last 5 lookups are kept in a small recent-history list for quick re-reference. Everything runs locally — no API calls, no network dependency — backed by a bundled airport code dataset.

Target browsers: Chrome, Edge, Firefox (Manifest V3, no Safari).

Architecture: vanilla HTML/CSS/JS, no framework, bundled JSON dataset, no network calls.

## Branding

Icons and branding use Fastly red `#FF282D` as the primary brand color. The icon source is `icons/icon.svg`; the PNG sizes (16/32/48/128) referenced in the manifest are rendered from it.

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

