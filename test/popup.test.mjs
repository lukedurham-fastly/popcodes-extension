import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = fs.realpathSync(path.resolve(__dirname, ".."));

// Chrome derives the ID of an unpacked (unsigned) extension from the SHA-256
// hash of its absolute load path, mapping each hex nibble to a letter a-p.
// This lets us address the popup directly without a background service
// worker, which this extension intentionally doesn't have.
function extensionIdFromPath(dirPath) {
  const hash = crypto.createHash("sha256").update(dirPath).digest();
  return hash
    .subarray(0, 16)
    .toString("hex")
    .split("")
    .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
    .join("");
}

// data/pops.json is generated at package time (scripts/fetch-pops.mjs) and
// gitignored, so swap in a small fixture for the test run to keep the POP
// badge tests deterministic; any real generated file is restored afterwards.
const popsPath = path.join(extensionPath, "data", "pops.json");
const originalPops = fs.existsSync(popsPath)
  ? fs.readFileSync(popsPath)
  : null;

before(() => {
  fs.writeFileSync(
    popsPath,
    JSON.stringify({
      AMS: {
        name: "Amsterdam",
        latitude: 52.308613,
        longitude: 4.763889,
        metro: false,
      },
      IAD: {
        name: "Ashburn",
        latitude: 38.944533,
        longitude: -77.455811,
        metro: true,
      },
    })
  );
});

after(() => {
  if (originalPops) {
    fs.writeFileSync(popsPath, originalPops);
  } else {
    fs.rmSync(popsPath);
  }
});

async function withExtensionPage(fn) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "popcodes-pw-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const extensionId = extensionIdFromPath(extensionPath);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await page.waitForFunction(() => window.__popcodesReady === true);
    await fn(page);
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

test("shows city/country for a known code, case-insensitively", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.dispatchEvent("#code-input", "input");
    assert.equal(
      await page.inputValue("#code-input"),
      "SFO",
      "input should be normalized to uppercase"
    );
    assert.equal(
      await page.textContent("#result"),
      "SFO — San Francisco, United States"
    );
  });
});

test("shows a not-found message for an unknown code", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "ZZZ");
    await page.dispatchEvent("#code-input", "input");
    assert.equal(
      await page.textContent("#result"),
      'No airport found for "ZZZ"'
    );
  });
});

test("clears the result while fewer than 3 characters are entered", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sf");
    await page.dispatchEvent("#code-input", "input");
    assert.equal(await page.textContent("#result"), "");
  });
});

test("typing a code does not add it to recents until Enter is pressed", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.dispatchEvent("#code-input", "input");
    assert.deepEqual(await page.locator("#recents-list li").allTextContents(), []);
  });
});

test("pressing Enter clears the input so the next code can be typed fresh", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");
    assert.equal(await page.inputValue("#code-input"), "");
    assert.equal(
      await page.textContent("#result"),
      "SFO — San Francisco, United States"
    );

    await page.fill("#code-input", "zzz");
    await page.press("#code-input", "Enter");
    assert.equal(await page.inputValue("#code-input"), "");
  });
});

test("pressing Enter on a valid code adds it to recents, most-recent-first", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");
    await page.fill("#code-input", "jfk");
    await page.press("#code-input", "Enter");

    assert.deepEqual(await page.locator("#recents-list li").allTextContents(), [
      "JFK — New York, United States",
      "SFO — San Francisco, United States",
    ]);
  });
});

test("pressing Enter on an unknown code does not add it to recents", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "zzz");
    await page.press("#code-input", "Enter");
    assert.deepEqual(await page.locator("#recents-list li").allTextContents(), []);
  });
});

test("re-looking up a code moves it to the top instead of duplicating it", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");
    await page.fill("#code-input", "jfk");
    await page.press("#code-input", "Enter");
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");

    assert.deepEqual(await page.locator("#recents-list li").allTextContents(), [
      "SFO — San Francisco, United States",
      "JFK — New York, United States",
    ]);
  });
});

test("recents list is capped at 5 entries", async () => {
  await withExtensionPage(async (page) => {
    for (const code of ["sfo", "jfk", "lax", "ord", "atl", "sea"]) {
      await page.fill("#code-input", code);
      await page.press("#code-input", "Enter");
    }

    assert.deepEqual(await page.locator("#recents-list li").allTextContents(), [
      "SEA — Seattle, United States",
      "ATL — Atlanta, United States",
      "ORD — Chicago, United States",
      "LAX — Los Angeles, United States",
      "JFK — New York, United States",
    ]);
  });
});

test("clicking a recent item re-shows its result", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");
    await page.fill("#code-input", "jfk");
    await page.press("#code-input", "Enter");

    await page.click("#recents-list li >> text=SFO");

    assert.equal(
      await page.textContent("#result"),
      "SFO — San Francisco, United States"
    );
    assert.equal(await page.inputValue("#code-input"), "SFO");
  });
});

test("deleting a recent entry removes it and leaves the others", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");
    await page.fill("#code-input", "jfk");
    await page.press("#code-input", "Enter");

    const sfoRow = page.locator("#recents-list li", { hasText: "SFO" });
    await sfoRow.locator(".recents__delete").click();

    assert.deepEqual(await page.locator("#recents-list li").allTextContents(), [
      "JFK — New York, United States",
    ]);
  });
});

test("a deleted recent entry stays deleted after the popup reloads", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");
    await page.fill("#code-input", "jfk");
    await page.press("#code-input", "Enter");

    const sfoRow = page.locator("#recents-list li", { hasText: "SFO" });
    await sfoRow.locator(".recents__delete").click();

    await page.reload();
    await page.waitForFunction(() => window.__popcodesReady === true);

    assert.deepEqual(await page.locator("#recents-list li").allTextContents(), [
      "JFK — New York, United States",
    ]);
  });
});

test("clicking the delete button does not re-show the row's lookup", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");
    await page.fill("#code-input", "jfk");
    await page.press("#code-input", "Enter");

    await page.fill("#code-input", "zzz");
    await page.dispatchEvent("#code-input", "input");

    const sfoRow = page.locator("#recents-list li", { hasText: "SFO" });
    await sfoRow.locator(".recents__delete").click();

    assert.equal(
      await page.textContent("#result"),
      'No airport found for "ZZZ"',
      "clicking delete should not trigger the row's show-lookup handler"
    );
  });
});

test("a POP airport code shows Fastly badge and map link", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "ams");
    await page.dispatchEvent("#code-input", "input");

    assert.match(
      await page.textContent("#result"),
      /^AMS — Amsterdam, Netherlands/
    );
    assert.equal(
      await page.getAttribute(".pop-badge--fastly", "aria-label"),
      "Official Fastly POP"
    );
    assert.equal(
      await page.locator(".pop-badge--metro").count(),
      0,
      "AMS is not a Metro POP"
    );

    const mapLink = page.locator(".pop-map-link");
    assert.equal(
      await mapLink.getAttribute("href"),
      "https://www.google.com/maps?q=52.308613,4.763889"
    );
    assert.equal(await mapLink.getAttribute("target"), "_blank");
    assert.equal(
      await mapLink.getAttribute("aria-label"),
      "Open Amsterdam POP location in Google Maps"
    );
  });
});

test("a Metro POP code also shows the Metro badge", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "iad");
    await page.dispatchEvent("#code-input", "input");

    assert.equal(await page.locator(".pop-badge--fastly").count(), 1);
    assert.equal(await page.textContent(".pop-badge--metro"), "Metro");
    assert.equal(
      await page.getAttribute(".pop-badge--metro", "aria-label"),
      "Metro POP"
    );
  });
});

test("a non-POP airport code shows no badges", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "anc");
    await page.dispatchEvent("#code-input", "input");

    assert.equal(
      await page.textContent("#result"),
      "ANC — Anchorage, United States"
    );
    assert.equal(await page.locator(".pop-badges").count(), 0);
  });
});

test("clicking a recent POP lookup re-shows its badges", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "ams");
    await page.press("#code-input", "Enter");
    await page.fill("#code-input", "anc");
    await page.press("#code-input", "Enter");

    await page.click("#recents-list li >> text=AMS");

    assert.equal(await page.locator(".pop-badge--fastly").count(), 1);
  });
});

test("a POP code in recents shows the Fastly icon but no Metro badge or map link", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "ams");
    await page.press("#code-input", "Enter");

    const row = page.locator("#recents-list li", { hasText: "AMS" });
    assert.equal(
      await row.locator(".recents__pop-icon").getAttribute("aria-label"),
      "Fastly POP"
    );
    assert.equal(await row.locator(".pop-badge--metro").count(), 0);
    assert.equal(await row.locator(".pop-map-link").count(), 0);
  });
});

test("a non-POP code in recents shows no Fastly icon", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "anc");
    await page.press("#code-input", "Enter");

    const row = page.locator("#recents-list li", { hasText: "ANC" });
    assert.equal(await row.locator(".recents__pop-icon").count(), 0);
  });
});

test("recents persist across popup reloads", async () => {
  await withExtensionPage(async (page) => {
    await page.fill("#code-input", "sfo");
    await page.press("#code-input", "Enter");

    await page.reload();
    await page.waitForFunction(() => window.__popcodesReady === true);

    assert.deepEqual(await page.locator("#recents-list li").allTextContents(), [
      "SFO — San Francisco, United States",
    ]);
  });
});
