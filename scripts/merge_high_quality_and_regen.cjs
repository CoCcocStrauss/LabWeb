/**
 * Merge new A-class content (AI + eldercare only) into raw zhihu_answers*.csv,
 * replacing existing A rows, then re-run generate-materials scripts.
 *
 * Fertility A content is untouched.
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
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQuotes = false; i++; continue; }
      field += c; i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function serializeRow(cells) {
  return cells.map((f, i) => (i === 4 ? '"' + f.replace(/"/g, '""') + '"' : f)).join(",");
}

const TOPICS = [
  { key: "ai", srcCsv: "zhihu_answers_ai.csv", newCsv: "new_high_quality_ai.csv", script: "scripts/generate-materials-ai.mjs" },
  { key: "eldercare", srcCsv: "zhihu_answers_eldercare.csv", newCsv: "new_high_quality_eldercare.csv", script: "scripts/generate-materials-eldercare.mjs" },
];

for (const t of TOPICS) {
  const srcPath = path.join(ROOT, t.srcCsv);
  const newPath = path.join(ROOT, t.newCsv);
  const backupPath = srcPath + ".bak_A_" + Date.now();
  fs.copyFileSync(srcPath, backupPath);

  const srcRows = parseCsv(fs.readFileSync(srcPath, "utf8"));
  const newRows = parseCsv(fs.readFileSync(newPath, "utf8"));

  const header = srcRows[0];
  const keptRows = srcRows.slice(1).filter(r => r.length >= 5 && !r[0].startsWith("A"));
  const droppedCount = srcRows.length - 1 - keptRows.length;
  const newBodyRows = newRows.slice(1).filter(r => r.length >= 5 && r[0].startsWith("A"));

  const finalRows = [header, ...newBodyRows, ...keptRows];
  fs.writeFileSync(srcPath, finalRows.map(serializeRow).join("\n") + "\n", "utf8");
  console.log(`[${t.key}] backup -> ${path.basename(backupPath)}, dropped ${droppedCount} old A rows, added ${newBodyRows.length} new A rows, kept ${keptRows.length} B rows`);
}

console.log("\n--- Regenerating materials JSON ---");
for (const t of TOPICS) {
  console.log(`\n> node ${t.script}`);
  execSync(`node ${t.script}`, { cwd: ROOT, stdio: "inherit" });
}
