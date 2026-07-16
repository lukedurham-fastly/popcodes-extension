const input = document.getElementById("code-input");
const result = document.getElementById("result");

let airports = null;

fetch("../data/airports.json")
  .then((response) => response.json())
  .then((data) => {
    airports = data;
    lookup(input.value);
  });

function lookup(rawValue) {
  const code = rawValue.toUpperCase();

  if (code !== rawValue) {
    input.value = code;
  }

  if (code.length < 3) {
    result.textContent = "";
    return;
  }

  if (!airports) {
    return;
  }

  const airport = airports[code];

  if (!airport) {
    result.textContent = `No airport found for "${code}"`;
    return;
  }

  result.textContent = `${code} — ${airport.city}, ${airport.country}`;
}

input.addEventListener("input", () => lookup(input.value));
