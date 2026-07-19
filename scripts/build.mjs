// Packages the extension for each target browser into /dist.
//
// For each of chrome, edge, firefox:
//   - copies /src, /data, /icons into dist/<browser>/
//   - writes the manifest variant for that browser
//   - zips the result into dist/popcodes-<browser>-<version>.zip
//
// Chrome and Edge share one manifest (no browser_specific_settings);
// Firefox keeps the gecko keys from the root manifest.json.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// The Fastly POP list is fetched at package time, never at extension runtime
// and never committed — regenerate it before zipping anything.
try {
  execFileSync("node", [join(root, "scripts", "fetch-pops.mjs")], {
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}
if (!existsSync(join(root, "data", "pops.json"))) {
  console.error(
    "error: data/pops.json is missing — run `node scripts/fetch-pops.mjs` (requires FASTLY_API_TOKEN)"
  );
  process.exit(1);
}

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
      // ship only runtime files: no dev tooling like data/generate-airports.py,
      // no dotfile junk like .DS_Store
      filter: (src) => !src.endsWith(".py") && !basename(src).startsWith("."),
    });
  }
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(targetManifest, null, 2) + "\n"
  );

  const zipName = `popcodes-${browser}-${manifest.version}.zip`;
  // -X omits platform extra fields (mtimes are still stored, so archives
  // aren't byte-identical across runs).
  try {
    execFileSync("zip", ["-q", "-X", "-r", join("..", zipName), "."], {
      cwd: outDir,
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(
        "error: `zip` command not found — install it or run the build on macOS/Linux"
      );
      process.exit(1);
    }
    throw err;
  }
  console.log(`built dist/${zipName}`);
}
