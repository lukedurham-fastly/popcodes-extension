const input = document.getElementById("code-input");
const result = document.getElementById("result");
const recentsList = document.getElementById("recents-list");

const RECENTS_KEY = "recentLookups";
const MAX_RECENTS = 5;

let airports = null;
let pops = {};

Promise.all([
  fetch("../data/airports.json").then((response) => response.json()),
  // pops.json is generated at package time (scripts/fetch-pops.mjs) and may be
  // absent in a dev checkout — treat that as "no POPs", not a load failure.
  fetch("../data/pops.json")
    .then((response) => response.json())
    .catch(() => ({})),
])
  .then(([airportData, popData]) => {
    airports = airportData;
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

  const entry = { code, city: airport.city, country: airport.country };
  showResult(entry);
  return entry;
}

function showResult(entry) {
  result.textContent = `${entry.code} — ${entry.city}, ${entry.country}`;

  const pop = pops[entry.code];
  if (pop) {
    result.appendChild(renderPopBadges(pop));
  }
}

function renderPopBadges(pop) {
  const badges = document.createElement("div");
  badges.className = "pop-badges";

  const fastlyBadge = document.createElement("span");
  fastlyBadge.className = "pop-badge pop-badge--fastly";
  fastlyBadge.title = "Official Fastly POP";
  fastlyBadge.setAttribute("aria-label", "Official Fastly POP");
  const icon = document.createElement("img");
  icon.className = "pop-badge__icon";
  icon.src = "../icons/icon.svg";
  icon.alt = "";
  fastlyBadge.append(icon, "Fastly POP");
  badges.appendChild(fastlyBadge);

  if (pop.metro) {
    const metroBadge = document.createElement("span");
    metroBadge.className = "pop-badge pop-badge--metro";
    metroBadge.textContent = "Metro";
    metroBadge.title = "Metro POP";
    metroBadge.setAttribute("aria-label", "Metro POP");
    badges.appendChild(metroBadge);
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
    item.textContent = `${entry.code} — ${entry.city}, ${entry.country}`;
    item.addEventListener("click", () => {
      input.value = entry.code;
      showResult(entry);
    });
    recentsList.appendChild(item);
  }
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
