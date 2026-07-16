const input = document.getElementById("code-input");
const result = document.getElementById("result");
const recentsList = document.getElementById("recents-list");

const RECENTS_KEY = "recentLookups";
const MAX_RECENTS = 5;

let airports = null;

fetch("../data/airports.json")
  .then((response) => response.json())
  .then((data) => {
    airports = data;
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
}

function getRecents() {
  return new Promise((resolve) => {
    chrome.storage.local.get(RECENTS_KEY, (data) => {
      resolve(data[RECENTS_KEY] || []);
    });
  });
}

function setRecents(recents) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [RECENTS_KEY]: recents }, resolve);
  });
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

input.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  const entry = lookup(input.value);

  if (entry) {
    addRecent(entry);
  }
});
