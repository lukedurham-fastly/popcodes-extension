const input = document.getElementById("code-input");
const result = document.getElementById("result");
const recentsList = document.getElementById("recents-list");

const RECENTS_KEY = "recentLookups";
const MAX_RECENTS = 5;

let airports = null;
let pops = {};
let overrideCodes = new Set();

Promise.all([
  fetch("../data/airports.json").then((response) => response.json()),
  fetch("../data/metro-codes.json").then((response) => response.json()),
  fetch("../data/fastly-codes.json").then((response) => response.json()),
  // pops.json is generated at package time (scripts/fetch-pops.mjs) and may be
  // absent in a dev checkout — treat that as "no POPs", not a load failure.
  fetch("../data/pops.json")
    .then((response) => response.json())
    .catch(() => ({})),
])
  .then(([airportData, metroCodes, fastlyCodes, popData]) => {
    // metro-codes.json and fastly-codes.json are hand-maintained overrides for
    // codes the canonical airport dataset will never contain (IATA metro-area
    // codes and Fastly-internal placeholder codes) — merged on top so they
    // resolve the same way a real airport code would.
    airports = { ...airportData, ...metroCodes, ...fastlyCodes };
    overrideCodes = new Set([...Object.keys(metroCodes), ...Object.keys(fastlyCodes)]);
    pops = popData;
    lookup(input.value);
  })
  .catch(() => {
    result.textContent = "Failed to load airport data";
  })
  .then(() => renderRecents())
  .finally(() => {
    window.__popcodesReady = true;
  });

function lookup(rawValue) {
  const code = rawValue.toUpperCase();

  if (code !== rawValue) {
    input.value = code;
  }

  if (code.length < 3) {
    result.textContent = "";
    return null;
  }

  if (!airports) {
    return null;
  }

  const airport = airports[code];

  if (!airport) {
    result.textContent = `No airport found for "${code}"`;
    return null;
  }

  const entry = {
    code,
    city: airport.city,
    country: airport.country,
    override: overrideCodes.has(code),
  };
  showResult(entry);
  return entry;
}

function showResult(entry) {
  result.textContent = `${entry.code} — ${entry.city}, ${entry.country}`;

  const pop = pops[entry.code];
  if (entry.override || pop) {
    result.appendChild(renderBadges(entry, pop));
  }
}

// Shared by renderPopBadges() (result area) and renderList() (recents list)
// so both places render the exact same Fastly icon markup. The <img> alt is
// always empty because the accessible label lives on whichever element wraps
// the icon at the call site.
function renderFastlyIcon() {
  const icon = document.createElement("img");
  icon.className = "pop-badge__icon";
  icon.src = "../icons/icon-small.svg";
  icon.alt = "";
  return icon;
}

// Shared by every badge in renderBadges() so each one only has to specify
// what's different: its class suffix, visible content, and accessible label.
function createBadge(className, content, label) {
  const badge = document.createElement("span");
  badge.className = `pop-badge ${className}`;
  badge.title = label;
  badge.setAttribute("aria-label", label);
  badge.append(...[].concat(content));
  return badge;
}

function renderBadges(entry, pop) {
  const badges = document.createElement("div");
  badges.className = "pop-badges";

  if (entry.override) {
    badges.appendChild(
      createBadge(
        "pop-badge--override",
        "Not an IATA airport",
        "City/country data is hand-maintained, not from the IATA airport dataset"
      )
    );
  }

  if (!pop) {
    return badges;
  }

  badges.appendChild(
    createBadge("pop-badge--fastly", [renderFastlyIcon(), "Fastly POP"], "Official Fastly POP")
  );

  if (pop.metro) {
    badges.appendChild(createBadge("pop-badge--metro", "Metro", "Metro POP"));
  }

  const mapLink = document.createElement("a");
  mapLink.className = "pop-map-link";
  mapLink.href = `https://www.google.com/maps?q=${pop.latitude},${pop.longitude}`;
  mapLink.target = "_blank";
  mapLink.rel = "noopener";
  const mapLabel = `Open ${pop.name} POP location in Google Maps`;
  mapLink.title = mapLabel;
  mapLink.setAttribute("aria-label", mapLabel);
  mapLink.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
    '<path fill="#FF282D" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>' +
    "</svg>";
  badges.appendChild(mapLink);

  return badges;
}

async function getRecents() {
  const data = await browser.storage.local.get(RECENTS_KEY);
  return data[RECENTS_KEY] || [];
}

function setRecents(recents) {
  return browser.storage.local.set({ [RECENTS_KEY]: recents });
}

async function addRecent(entry) {
  const recents = await getRecents();
  const deduped = recents.filter((r) => r.code !== entry.code);
  deduped.unshift(entry);
  const trimmed = deduped.slice(0, MAX_RECENTS);
  await setRecents(trimmed);
  renderList(trimmed);
}

async function renderRecents() {
  renderList(await getRecents());
}

function renderList(recents) {
  recentsList.innerHTML = "";

  for (const entry of recents) {
    const item = document.createElement("li");
    item.className = "recents__item";

    const label = document.createElement("span");
    label.className = "recents__label";
    label.textContent = `${entry.code} — ${entry.city}, ${entry.country}`;
    item.appendChild(label);

    // pops.json is absent in a dev checkout, so pops may be {} — that's
    // "no POPs", not an error, same as showResult() already treats it.
    if (pops[entry.code]) {
      item.appendChild(renderRecentPopIcon());
    }

    item.appendChild(renderDeleteButton(entry));

    item.addEventListener("click", () => {
      input.value = entry.code;
      showResult(entry);
    });
    recentsList.appendChild(item);
  }
}

function renderRecentPopIcon() {
  const wrapper = document.createElement("span");
  wrapper.className = "recents__pop-icon";
  wrapper.title = "Fastly POP";
  wrapper.setAttribute("aria-label", "Fastly POP");
  wrapper.appendChild(renderFastlyIcon());
  return wrapper;
}

function renderDeleteButton(entry) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "recents__delete";
  const label = `Remove ${entry.code} from recent lookups`;
  button.title = label;
  button.setAttribute("aria-label", label);
  // Feather Icons "trash-2" (MIT), inlined — no external asset/network fetch.
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="3 6 5 6 21 6"></polyline>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
    '<line x1="10" y1="11" x2="10" y2="17"></line>' +
    '<line x1="14" y1="11" x2="14" y2="17"></line>' +
    "</svg>";

  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const recents = await getRecents();
    const updated = recents.filter((r) => r.code !== entry.code);
    await setRecents(updated);
    renderList(updated);
  });

  return button;
}

input.addEventListener("input", () => lookup(input.value));

input.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }

  const entry = lookup(input.value);

  if (entry) {
    await addRecent(entry);
  }

  input.value = "";
});
