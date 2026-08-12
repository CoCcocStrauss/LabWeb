/**
 * One-off script: zhihu_answers.csv → app/data/materials/fertility.json
 * Run: node scripts/generate-materials-fertility.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// identityLabel = 现实职业身份（身份类）；platformLabel = 平台身份/影响力（平台类）
// 1/3 只有身份类 | 1/3 只有平台类 | 1/3 两个都有
const A_IDENTITY_MAP = {
  A1: { identityLabel: "妇产科副主任医师",            platformLabel: null },
  A2: { identityLabel: null,                          platformLabel: "知乎三孩话题优质答主" },
  A3: { identityLabel: "注册金融分析师",              platformLabel: "房产投资话题答主" },
  A4: { identityLabel: "应用心理学副教授",            platformLabel: null },
  A5: { identityLabel: "三孩家庭成员",               platformLabel: "育儿话题优质创作者" },
  A6: { identityLabel: "二级心理咨询师",             platformLabel: "婚姻情感话题答主" },
  A7: { identityLabel: "中国人民大学公共政策副研究员", platformLabel: null },
  A8: { identityLabel: "执业律师",                   platformLabel: null },
};

const B_HIGH_SOURCE_IDENTITIES = [
  { identityLabel: null,                         platformLabel: "时评话题优质创作者" },
  { identityLabel: "苏州市政协委员",             platformLabel: "生育政策话题答主" },
  { identityLabel: "市场研究总监",               platformLabel: null },
  { identityLabel: null,                         platformLabel: "家庭教育话题博主 · 50万粉丝" },
  { identityLabel: "华东理工大学社会工作系讲师", platformLabel: "家庭社会学话题答主" },
  { identityLabel: null,                         platformLabel: "孕产健康话题活跃用户" },
];

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([^,]+),([^,]+),(\d+),(\d+),"(.*)"$/s);
    if (!match) continue;
    const [, persona_id, stanceZh, index, , content] = match;
    if (!persona_id.startsWith("A") && !persona_id.startsWith("B")) continue;
    rows.push({
      persona_id,
      stance: stanceZh === "支持" ? "support" : "oppose",
      index: Number(index),
      content,
      quality: persona_id.startsWith("A") ? "high" : "low",
    });
  }
  return rows;
}

/** Fisher–Yates shuffle (mutates array) */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick 12 rows: index=1 from all 8 personas + index=2 from first 4 personas */
function selectTwelve(rows, stance, quality) {
  const pool = rows.filter((r) => r.stance === stance && r.quality === quality);
  const byPersona = new Map();
  for (const r of pool) {
    if (!byPersona.has(r.persona_id)) byPersona.set(r.persona_id, []);
    byPersona.get(r.persona_id).push(r);
  }
  for (const [, list] of byPersona) {
    list.sort((a, b) => a.index - b.index);
  }
  const personas = [...byPersona.keys()].sort();
  const picked = [];
  for (const p of personas) {
    const first = byPersona.get(p).find((r) => r.index === 1);
    if (first) picked.push(first);
  }
  for (let i = 0; i < 4; i++) {
    const second = byPersona.get(personas[i]).find((r) => r.index === 2);
    if (second) picked.push(second);
  }
  if (picked.length !== 12) {
    throw new Error(
      `Expected 12 items for stance=${stance} quality=${quality}, got ${picked.length}`
    );
  }
  return picked;
}

/** Assign sourceLevel: exactly 6 high + 6 low per group */
function assignSourceLevels(items) {
  const copy = [...items];
  shuffle(copy);
  return copy.map((item, i) => ({
    ...item,
    sourceLevel: i < 6 ? "high" : "low",
  }));
}

function cellKey(stance, sourceLevel, quality) {
  return `${stance}_${sourceLevel}_${quality}`;
}

function resolveIdentityLabels(item, bHighSourceIndex) {
  const empty = { identityLabel: null, platformLabel: null };
  if (item.sourceLevel === "low") return empty;
  if (item.quality === "high") return A_IDENTITY_MAP[item.persona_id] ?? empty;
  return B_HIGH_SOURCE_IDENTITIES[bHighSourceIndex % B_HIGH_SOURCE_IDENTITIES.length] ?? empty;
}

const CELL_ORDER = [
  "support_high_high",
  "support_high_low",
  "support_low_high",
  "support_low_low",
  "oppose_high_high",
  "oppose_high_low",
  "oppose_low_high",
  "oppose_low_low",
];

const CELL_PREFIX = {
  support_high_high: "shh",
  support_high_low: "shl",
  support_low_high: "slh",
  support_low_low: "sll",
  oppose_high_high: "ohh",
  oppose_high_low: "ohl",
  oppose_low_high: "olh",
  oppose_low_low: "oll",
};

const csv = readFileSync(join(root, "zhihu_answers.csv"), "utf-8");
const rows = parseCsv(csv);

const groups = [
  { stance: "support", quality: "high" },
  { stance: "support", quality: "low" },
  { stance: "oppose", quality: "high" },
  { stance: "oppose", quality: "low" },
];

const materials = Object.fromEntries(CELL_ORDER.map((k) => [k, []]));

for (const { stance, quality } of groups) {
  const twelve = selectTwelve(rows, stance, quality);
  const assigned = assignSourceLevels(twelve);
  for (const item of assigned) {
    const key = cellKey(item.stance, item.sourceLevel, item.quality);
    materials[key].push(item);
  }
}

let bHighSourceCounter = 0;

for (const cell of CELL_ORDER) {
  if (materials[cell].length !== 6) {
    throw new Error(`Cell ${cell} has ${materials[cell].length} items, expected 6`);
  }
  const prefix = CELL_PREFIX[cell];
  materials[cell] = materials[cell].map((item, i) => {
    let identityLabel = null;
    let platformLabel = null;
    if (item.sourceLevel === "high") {
      let labels;
      if (item.quality === "low") {
        labels = resolveIdentityLabels(item, bHighSourceCounter);
        bHighSourceCounter += 1;
      } else {
        labels = resolveIdentityLabels(item, 0);
      }
      identityLabel = labels.identityLabel;
      platformLabel = labels.platformLabel;
    }
    return {
      id: `${prefix}_${String(i + 1).padStart(2, "0")}`,
      content: item.content,
      quality: item.quality,
      sourceLevel: item.sourceLevel,
      stance: item.stance,
      identityLabel,
      platformLabel,
    };
  });
}

const output = {
  topic: "三胎购房补贴政策",
  topicDescription:
    "国家为三胎家庭提供50万元购房补贴，但要求十年内不离婚。你怎么看这项政策？",
  tags: ["生育政策", "三胎", "购房补贴"],
  materials,
};

const outPath = join(root, "app/data/materials/fertility.json");
writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
console.log(`Wrote ${outPath} (${CELL_ORDER.length} cells × 6 = 48 posts)`);
console.log(`B-class high-source identities assigned: ${bHighSourceCounter}`);
