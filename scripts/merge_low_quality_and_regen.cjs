/**
 * Merge new low-quality B-class content into the raw zhihu_answers*.csv files
 * (replacing all existing B* rows), then re-run each topic's generate-materials
 * pipeline so app/data/materials/*.json reflects the new content.
 *
 * Usage: node scripts/merge_low_quality_and_regen.cjs
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");

function parseCsv(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = ""; i++; continue;
      }
      field += c; i++;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function serializeRow(cells) {
  // Match the original CSV pipeline's expectation:
  // regex ^([^,]+),([^,]+),(\d+),(\d+),"(.*)"$
  // Only the content field needs quoting; others must NOT contain commas or quotes.
  return cells
    .map((f, i) => (i === 4 ? '"' + f.replace(/"/g, '""') + '"' : f))
    .join(",");
}

const TOPICS = [
  { key: "fertility", srcCsv: "zhihu_answers.csv", newCsv: "new_low_quality_fertility.csv", script: "scripts/generate-materials-fertility.mjs" },
  { key: "ai", srcCsv: "zhihu_answers_ai.csv", newCsv: "new_low_quality_ai.csv", script: "scripts/generate-materials-ai.mjs" },
  { key: "eldercare", srcCsv: "zhihu_answers_eldercare.csv", newCsv: "new_low_quality_eldercare.csv", script: "scripts/generate-materials-eldercare.mjs" },
];

for (const t of TOPICS) {
  const srcPath = path.join(ROOT, t.srcCsv);
  const newPath = path.join(ROOT, t.newCsv);

  const backupPath = srcPath + ".bak_" + Date.now();
  fs.copyFileSync(srcPath, backupPath);

  const srcRows = parseCsv(fs.readFileSync(srcPath, "utf8"));
  const newRows = parseCsv(fs.readFileSync(newPath, "utf8"));

  // Keep header + all non-B* rows from source; drop all B* rows entirely.
  const header = srcRows[0];
  const keptRows = srcRows.slice(1).filter(r => r.length >= 5 && !r[0].startsWith("B"));
  const droppedCount = srcRows.length - 1 - keptRows.length;

  // Append the new B-class rows (skip the header row of newCsv).
  const newBodyRows = newRows.slice(1).filter(r => r.length >= 5 && r[0].startsWith("B"));

  const finalRows = [header, ...keptRows, ...newBodyRows];
  const out = finalRows.map(serializeRow).join("\n") + "\n";
  fs.writeFileSync(srcPath, out, "utf8");

  console.log(`[${t.key}] backup -> ${path.basename(backupPath)}, dropped ${droppedCount} old B rows, added ${newBodyRows.length} new B rows, kept ${keptRows.length} A/C rows`);
}

console.log("\n--- Regenerating materials JSON ---");
for (const t of TOPICS) {
  console.log(`\n> node ${t.script}`);
  execSync(`node ${t.script}`, { cwd: ROOT, stdio: "inherit" });
}
