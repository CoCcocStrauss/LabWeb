const fs = require("fs");
const path = require("path");

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

function toCsv(rows) {
  return rows.map(r => r.map((f, i) => {
    if (i === 4) return '"' + f.replace(/"/g, '""') + '"';
    return f;
  }).join(",")).join("\n") + "\n";
}

const EXTENSIONS = {
  "ai|A4|支持|1": "有实验数据支持，感知一致性显著高于面试官轮换的传统流程，员工层面的抵触反而降了不少。",
  "ai|A5|反对|1": "算法的可审计性一直是行业里推不动的事，涉及各方利益，短期看解不开。",
  "eldercare|A4|支持|1": "尤其在65岁以上样本里，前额叶皮层的激活模式在跨代际互动中差异非常显著。",
  "eldercare|A5|反对|1": "楼里住得久的都懂，热闹不等于活力，硬造的关系撑不了几个月。",
  "eldercare|A1|支持|2": "同一批老人的用药支出跟着降了大概两成，家属满意度反馈也明显改善。",
  "eldercare|A1|反对|2": "这些运营账我们后期算得越来越清楚，最终决定终止试点。",
};

const FILES = [
  { topic: "ai", file: "new_high_quality_ai.csv" },
  { topic: "eldercare", file: "new_high_quality_eldercare.csv" },
];

const ROOT = path.join(__dirname, "..");
for (const { topic, file } of FILES) {
  const filePath = path.join(ROOT, file);
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  let n = 0;
  for (const r of rows) {
    if (r.length < 5 || r[0] === "persona_id") continue;
    const key = `${topic}|${r[0]}|${r[1]}|${r[2]}`;
    const ext = EXTENSIONS[key];
    if (ext) {
      let c = r[4];
      r[4] = /[。！？]$/.test(c) ? c + ext : c + "。" + ext;
      n++;
    }
  }
  fs.writeFileSync(filePath, toCsv(rows), "utf8");
  console.log(`${file}: extended ${n} rows`);
}
