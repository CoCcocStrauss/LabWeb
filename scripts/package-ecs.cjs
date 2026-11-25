#!/usr/bin/env node
// Build a source-only release. Native dependencies must be installed on Linux.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const output = path.resolve(process.argv[2] || path.join(os.tmpdir(), `labweb-ecs-${stamp}.tar.gz`));
if (fs.existsSync(output)) throw new Error("Output already exists; choose a new filename");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "labweb-ecs-source-"));
const stage = path.join(temp, "labweb");
fs.mkdirSync(stage);
const manifest = [];
const allowedRoots = ["app", "deployment/ecs", "package.json", "package-lock.json", "next.config.mjs",
  "next-env.d.ts", "tsconfig.json", "postcss.config.mjs", "tailwind.config.ts",
  "supabase/release-materials-20261125.sql", "supabase/check-materials-20261125.sql"];
function copy(relative) {
  const source = path.join(root, relative);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Symlink is not allowed: ${relative}`);
  if (stat.isDirectory()) {
    fs.mkdirSync(path.join(stage, relative), { recursive: true });
    for (const entry of fs.readdirSync(source).sort()) copy(path.join(relative, entry));
  } else {
    if (/(^|\/)\.env|\.pem$|\.key$/i.test(relative)) throw new Error(`Forbidden release file: ${relative}`);
    fs.mkdirSync(path.dirname(path.join(stage, relative)), { recursive: true });
    fs.copyFileSync(source, path.join(stage, relative));
    manifest.push({ path: relative, sha256: crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex") });
  }
}
try {
  for (const entry of allowedRoots) copy(entry);
  // Only current app assets; research prompts in public/ are deliberately not published.
  copy("public/avatars");
  const publicExcluded = fs.readdirSync(path.join(root, "public")).filter(name => name !== "avatars");
  fs.writeFileSync(path.join(stage, "release-manifest.json"), JSON.stringify({
    createdAt: new Date().toISOString(), buildOn: "Linux x64, Node.js 24", files: manifest,
    excludedPublicEntries: publicExcluded,
  }, null, 2) + "\n");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync("tar", ["-czf", output, "-C", temp, "labweb"]);
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(output)).digest("hex");
  console.log(JSON.stringify({ archive: output, sha256, files: manifest.length, excludedPublicEntries: publicExcluded }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
