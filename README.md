# popcodes-extension

A lightweight browser extension for looking up IATA airport codes. Click the toolbar icon, type a 3-letter code (e.g. SYD), and the popup shows the matching city and country. The last 5 lookups are kept in a small recent-history list for quick re-reference. Everything runs locally — no API calls, no network dependency — backed by a bundled airport code dataset.

Target browsers: Chrome, Edge, Firefox (Manifest V3, no Safari).

Architecture: vanilla HTML/CSS/JS, no framework, bundled JSON dataset, no network calls.

