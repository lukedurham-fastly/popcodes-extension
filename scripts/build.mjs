// Packages the extension for each target browser into /dist.
//
// For each of chrome, edge, firefox:
//   - copies /src, /data, /icons into dist/<browser>/
//   - writes the manifest variant for that browser
//   - zips the result into dist/popcodes-<browser>-<version>.zip
//
// Chrome and Edge share one manifest (no browser_specific_settings);
// Firefox keeps the gecko keys from the root manifest.json.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

const chromiumManifest = structuredClone(manifest);
delete chromiumManifest.browser_specific_settings;

const targets = {
  chrome: chromiumManifest,
  edge: chromiumManifest,
  firefox: manifest,
};

rmSync(dist, { recursive: true, force: true });

for (const [browser, targetManifest] of Object.entries(targets)) {
  const outDir = join(dist, browser);
  mkdirSync(outDir, { recursive: true });

  for (const folder of ["src", "data", "icons"]) {
    cpSync(join(root, folder), join(outDir, folder), {
      recursive: true,
      // ship only runtime files, not dev tooling like data/generate-airports.py
      filter: (src) => !src.endsWith(".py"),
    });
  }
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(targetManifest, null, 2) + "\n"
  );

  const zipName = `popcodes-${browser}-${manifest.version}.zip`;
  // -X omits platform extra fields so the archive is reproducible.
  execFileSync("zip", ["-q", "-X", "-r", join("..", zipName), "."], {
    cwd: outDir,
  });
  console.log(`built dist/${zipName}`);
}
