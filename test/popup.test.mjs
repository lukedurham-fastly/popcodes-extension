import { test } from "node:test";
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
