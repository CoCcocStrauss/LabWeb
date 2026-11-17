// Import the reviewed Excel workbooks without regenerating or rewriting their prose.
// Usage: node scripts/import-materials-table.cjs [workbook-directory]
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");

const root = path.resolve(__dirname, "..");
const directory = path.resolve(process.argv[2] || path.join(root, ".."));
const topics = [
  { key: "fertility", file: "语料信息表_育儿补贴议题.xlsx", tags: ["育儿补贴", "生育"] },
  { key: "ai", file: "语料信息表_AI就业议题.xlsx", tags: ["人工智能", "就业"] },
];
const cells = ["support_high_high", "support_high_low", "support_low_high", "support_low_low", "oppose_high_high", "oppose_high_low", "oppose_low_high", "oppose_low_low"];
const splitCandidates = value => String(value || "").split(" / ").map(s => s.trim()).filter(Boolean);

for (const topic of topics) {
  const workbook = XLSX.readFile(path.join(directory, topic.file));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
  const notes = Object.fromEntries(XLSX.utils.sheet_to_json(workbook.Sheets["质检与说明"], { header: 1 }).map(row => [row[0], row[1]]));
  assert.equal(rows.length, 48, `${topic.key}: expected 48 posts`);
  assert.ok(notes["议题"] && notes["议题补充"], `${topic.key}: missing topic text`);
  const materials = Object.fromEntries(cells.map(cell => [cell, []]));
  const ids = new Set();
  for (const row of rows) {
    const stance = ({ "支持": "support", "反对": "oppose" })[row["立场"]];
    const quality = ({ "高": "high", "低": "low" })[row["质量"]];
    const sourceLevel = String(row["信源等级"]).startsWith("高") ? "high" : String(row["信源等级"]).startsWith("低") ? "low" : null;
    assert.ok(stance && quality && sourceLevel, `Invalid attributes: ${row["帖子ID"]}`);
    const cell = `${stance}_${sourceLevel}_${quality}`;
    const id = row["帖子ID"];
    const expectedPrefix = `${stance === "support" ? "s" : "o"}${sourceLevel[0]}${quality[0]}_`;
    assert.ok(typeof id === "string" && id.startsWith(expectedPrefix) && !ids.has(id), `Invalid/duplicate ID: ${id}`);
    assert.ok(typeof row["语料内容"] === "string" && row["语料内容"].trim(), `Empty post: ${id}`);
    ids.add(id);
    const post = { id, content: row["语料内容"], quality, sourceLevel, stance, identityLabel: row["身份类标签"] || null, platformLabel: row["平台类标签"] || null };
    if (sourceLevel === "high") {
      assert.ok(post.identityLabel || post.platformLabel, `Missing source label: ${id}`);
      const names = splitCandidates(row["候选昵称"]), avatars = splitCandidates(row["候选头像文件"]);
      assert.ok(names.length && names.length === avatars.length, `Mismatched author candidates: ${id}`);
      post.sourceCandidates = names.map((displayName, index) => {
        const avatarFile = avatars[index];
        assert.equal(path.basename(avatarFile), avatarFile);
        assert.ok(fs.existsSync(path.join(root, "public", "avatars", avatarFile)), `Missing avatar: ${avatarFile}`);
        return { displayName, avatarFile };
      });
    } else {
      assert.ok(!post.identityLabel && !post.platformLabel, `Low source has certification: ${id}`);
    }
    materials[cell].push(post);
  }
  for (const cell of cells) assert.equal(materials[cell].length, 6, `${topic.key}/${cell}: expected 6 posts`);
  const output = { topic: notes["议题"], topicDescription: notes["议题补充"], tags: topic.tags, materials };
  fs.writeFileSync(path.join(root, "app", "data", "materials", `${topic.key}.json`), JSON.stringify(output, null, 2) + "\n");
  console.log(`${topic.key}: imported ${ids.size} posts from ${topic.file}`);
}
