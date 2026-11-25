const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const XLSX = require("xlsx");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative) {
  let file = path.resolve(root, relative);
  if (!path.extname(file)) file += ".ts";
  if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file, "utf8"));
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = name => name.startsWith(".") ? load(path.resolve(path.dirname(file), name)) : require(name);
  new vm.Script(`(function(require,module,exports){${compiled}\n})`, { filename: file }).runInThisContext()(localRequire, module, module.exports);
  return module.exports;
}
const { TOPIC_KEYS, isTopicKey } = load("app/data/topics.ts");
const { assignCondition } = load("app/protocol/v5/lib/conditionAssignment.ts");
const { blockRandomize } = load("app/lib/blockRandomize.ts");
const { enrichPostsForDisplay } = load("app/lib/enrichPosts.ts");
const { validDisplayedLabel } = load("app/lib/labelSelection.ts");
assert.deepEqual(TOPIC_KEYS, ["fertility", "ai"]);
assert.equal(isTopicKey("eldercare"), false);
const assignments = new Map();
for (let i = 0; i < 10000; i++) {
  const uid = `material-check-${i}`;
  const assigned = assignCondition(uid);
  assert.deepEqual(assigned, assignCondition(uid));
  assert.ok([8, 24, 48].includes(assigned.conditionN));
  assert.ok(TOPIC_KEYS.includes(assigned.topic));
  const key = `${assigned.topic}/${assigned.conditionN}`;
  assignments.set(key, (assignments.get(key) || 0) + 1);
}
assert.equal(assignments.size, 6);
for (const topic of TOPIC_KEYS) {
  const data = load(`app/data/materials/${topic}.json`);
  assert.equal(Object.keys(data.materials).length, 8);
  for (const [cell, posts] of Object.entries(data.materials)) {
    assert.equal(posts.length, 6);
    for (const post of posts) assert.equal(`${post.stance}_${post.sourceLevel}_${post.quality}`, cell);
  }
  for (const n of [8, 24, 48]) for (let trial = 0; trial < 20; trial++) {
    const posts = blockRandomize(data.materials, n);
    assert.equal(posts.length, n);
    assert.equal(new Set(posts.map(p => p.id)).size, n);
    for (let offset = 0; offset < n; offset += 8) {
      assert.equal(new Set(posts.slice(offset, offset + 8).map(p => `${p.stance}_${p.sourceLevel}_${p.quality}`)).size, 8);
    }
    for (const p of enrichPostsForDisplay(posts, topic)) {
      assert.ok(validDisplayedLabel(p,p));
      if (p.sourceLevel === "high") {
        assert.ok(p.identityLabel || p.platformLabel);
        assert.ok(p.sourceCandidates.some(c => c.displayName === p.displayName && c.avatarFile === p.avatarFile));
        assert.ok(fs.existsSync(path.join(root, "public", "avatars", p.avatarFile)));
      } else {
        assert.ok(!p.identityLabel && !p.platformLabel && !p.avatarFile);
      }
    }
  }
  const file = topic === "fertility" ? "语料信息表_育儿补贴议题.xlsx" : "语料信息表_AI就业议题.xlsx";
  const source = path.join(root, "..", file);
  if (fs.existsSync(source)) {
    const workbook = XLSX.readFile(source);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const posts = new Map(Object.values(data.materials).flat().map(p => [p.id, p]));
    assert.equal(rows.length, posts.size);
    for (const row of rows) {
      const p = posts.get(row["帖子ID"]);
      assert.equal(p.content, row["语料内容"]);
      assert.equal(p.identityLabel, row["身份类标签"] || null);
      assert.equal(p.platformLabel, row["平台类标签"] || null);
      if (p.sourceLevel === "high") {
        const split = value => String(value || "").split(" / ").map(s => s.trim()).filter(Boolean);
        const names = split(row["候选昵称"]), avatars = split(row["候选头像文件"]);
        assert.deepEqual(p.sourceCandidates, names.map((displayName, i) => ({ displayName, avatarFile: avatars[i] })));
      }
    }
    console.log(`${topic}: 48 reviewed workbook posts, labels and author pairs match; 8/24/48 sampling verified`);
  }
}
console.log("6 conditions are deterministic and reachable; no eldercare assignment");
