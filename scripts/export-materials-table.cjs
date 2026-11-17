// 将两个正式议题的全部语料 + 身份/头像候选信息导出为多 sheet 的 Excel 表格，
// 用于人工核对"语料内容 是否匹配 身份描述"、"语料内容 是否匹配 高/低质量标签"。
// 用法：node scripts/export-materials-table.cjs
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");

function extractObject(src, varName) {
  const re = new RegExp(
    "export const " + varName + " = (\\{[\\s\\S]*?\\n\\})(?:\\s*as const)?[^;]*;"
  );
  const m = src.match(re);
  if (!m) throw new Error("not found: " + varName);
  // eslint-disable-next-line no-eval
  return eval("(" + m[1] + ")");
}

const avatarPoolSrc = fs.readFileSync(
  path.join(ROOT, "app/data/avatarPool.ts"),
  "utf8"
);
const HIGH_SOURCE_AVATAR_MAP = extractObject(avatarPoolSrc, "HIGH_SOURCE_AVATAR_MAP");
const HIGH_SOURCE_NAMES_BY_IDENTITY_BY_TOPIC = extractObject(
  avatarPoolSrc,
  "HIGH_SOURCE_NAMES_BY_IDENTITY_BY_TOPIC"
);

const TOPICS = [
  { key: "fertility", label: "生育", file: "app/data/materials/fertility.json" },
  { key: "ai", label: "AI", file: "app/data/materials/ai.json" },
];

const CELL_LABELS = {
  support_high_high: "支持 / 高信源 / 高质量",
  support_high_low: "支持 / 高信源 / 低质量",
  support_low_high: "支持 / 低信源 / 高质量",
  support_low_low: "支持 / 低信源 / 低质量",
  oppose_high_high: "反对 / 高信源 / 高质量",
  oppose_high_low: "反对 / 高信源 / 低质量",
  oppose_low_high: "反对 / 低信源 / 高质量",
  oppose_low_low: "反对 / 低信源 / 低质量",
};

const STANCE_LABEL = { support: "支持", oppose: "反对" };
const QUALITY_LABEL = { high: "高", low: "低" };
const SOURCE_LABEL = { high: "高（有认证标签）", low: "低（匿名网友）" };

/** 用 identityLabel（有则用）或 platformLabel 作为 lookup key，与 enrichPosts 逻辑保持一致 */
function nicknamesAndAvatarsForIdentity(topicKey, identityLabel, platformLabel) {
  const pool = HIGH_SOURCE_NAMES_BY_IDENTITY_BY_TOPIC[topicKey];
  const lookupKey = identityLabel || platformLabel;
  const names = (pool && lookupKey && pool[lookupKey]) || [];
  const avatars = names.map((n) => HIGH_SOURCE_AVATAR_MAP[n] || "(未配置头像)");
  return { names, avatars };
}

const wb = XLSX.utils.book_new();
const allRows = [];

for (const topic of TOPICS) {
  const data = require(path.join(ROOT, topic.file));
  const rows = [];
  const cellOrder = Object.keys(CELL_LABELS);
  for (const cellKey of cellOrder) {
    const posts = data.materials[cellKey] || [];
    for (const post of posts) {
      const isHighSource = post.sourceLevel === "high";
      let nicknames = "";
      let avatarFiles = "";
      if (isHighSource && (post.identityLabel || post.platformLabel)) {
        const { names, avatars: avs } = post.sourceCandidates?.length
          ? { names: post.sourceCandidates.map(c => c.displayName), avatars: post.sourceCandidates.map(c => c.avatarFile) }
          : nicknamesAndAvatarsForIdentity(topic.key, post.identityLabel, post.platformLabel);
        nicknames = names.join(" / ");
        avatarFiles = avs.join(" / ");
      } else if (isHighSource) {
        nicknames = "（高信源：待从昵称池分配）";
        avatarFiles = "（高信源：待匹配头像）";
      } else {
        nicknames = "（低信源：从通用网名池随机分配）";
        avatarFiles = "（低信源：无固定头像）";
      }

      const row = {
        议题: topic.label,
        分组Cell: CELL_LABELS[cellKey],
        立场: STANCE_LABEL[post.stance] || post.stance,
        质量: QUALITY_LABEL[post.quality] || post.quality,
        信源等级: SOURCE_LABEL[post.sourceLevel] || post.sourceLevel,
        帖子ID: post.id,
        身份类标签: post.identityLabel || "",
        平台类标签: post.platformLabel || "",
        候选昵称: nicknames,
        候选头像文件: avatarFiles,
        语料内容: post.content,
      };
      rows.push(row);
      allRows.push(row);
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = [
    { wch: 6 },   // 议题
    { wch: 18 },  // 分组Cell
    { wch: 6 },   // 立场
    { wch: 6 },   // 质量
    { wch: 16 },  // 信源等级
    { wch: 10 },  // 帖子ID
    { wch: 22 },  // 身份类标签
    { wch: 22 },  // 平台类标签
    { wch: 24 },  // 候选昵称
    { wch: 30 },  // 候选头像文件
    { wch: 80 },  // 语料内容
  ];
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, topic.label);
}

const wsAll = XLSX.utils.json_to_sheet(allRows);
wsAll["!cols"] = [
  { wch: 6 },
  { wch: 18 },
  { wch: 6 },
  { wch: 6 },
  { wch: 16 },
  { wch: 10 },
  { wch: 22 },
  { wch: 22 },
  { wch: 24 },
  { wch: 30 },
  { wch: 80 },
];
XLSX.utils.book_append_sheet(wb, wsAll, "全部议题汇总");
// 让"全部议题汇总"排在第一个 sheet
wb.SheetNames.unshift(wb.SheetNames.pop());

const outPath = path.join(ROOT, "语料信息表.xlsx");
XLSX.writeFile(wb, outPath);
console.log("导出成功：", outPath, "，共", allRows.length, "行");
