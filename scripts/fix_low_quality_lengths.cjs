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
    if (i === 4) {
      // content field: always quote, escape internal quotes
      return '"' + f.replace(/"/g, '""') + '"';
    }
    return f;
  }).join(",")).join("\n") + "\n";
}

// Targeted extensions: keyed by "topic|persona|stance|index"
// Extensions are appended before the trailing period of the last sentence,
// or as a new sentence at the end when there is trailing sentence-final punctuation.
const EXTENSIONS = {
  // AI
  "ai|B3|支持|1": "反正遇到这类嘴硬的人也没必要认真回应，看两眼就过。",
  "ai|B4|支持|1": "这种事情认得清就跟着走，看不清的自然会被时代甩掉，规律就是这样。",
  "ai|B2|反对|1": "所有看起来先进的技术手段，剥开外皮往往还是那一套老逻辑在跑。",
  "ai|B4|反对|1": "反正不合理就是不合理，硬要推的话最后要出事的还是普通求职者。",
  "ai|B6|反对|1": "见过太多这种人自我感觉良好其实特别冷血，跟他们讲不通的。",
  "ai|B2|支持|2": "有些人就是喜欢没事找事，看什么都想反对一下罢了。",
  "ai|B4|支持|2": "遇到这类嘴硬的人真没啥好聊的，让他们继续骂就是了，不影响大局。",
  "ai|B2|反对|2": "网上说得漂亮的多半是没被算法真正处理过的人。",
  "ai|B3|反对|2": "看多几年就明白了，这类做法核心从来没变过，只是换了个说法。",
  // Eldercare
  "eldercare|B2|支持|1": "外面写文章骂的很多其实连一天都没在养老院实际待过。",
  "eldercare|B4|支持|1": "该实施就实施，能帮到人的事就不要绕来绕去，反正结果摆在那儿，好东西就是好东西。",
  "eldercare|B6|支持|1": "这种发言看两眼就过，别较真，没必要费口舌。",
  "eldercare|B8|支持|1": "国外经验都在那儿摆着，咱们该学的就是要学。",
  "eldercare|B4|反对|1": "养老院该请专业护工就请专业护工，不能拿廉价房租凑数糊弄过去。",
  "eldercare|B7|反对|1": "真感受过陪护老人是什么滋味的人不会天天在网上把这事说得诗情画意。",
  "eldercare|B8|反对|1": "养老是专业的事，非要把年轻人硬塞进去多半是行政拍脑袋定的。",
  "eldercare|B2|支持|2": "年轻人有便宜住老人有人陪，这种事情推就完了，别整那么多弯弯绕。别的地方能这么做咱们没道理做不了。",
  "eldercare|B4|支持|2": "现实压力面前所谓的自由不过是一种奢侈，尝过就知道了。",
  "eldercare|B2|反对|2": "真在意老人的人早就自己想办法陪家里那位了，谁天天挂网上聊这个。",
  "eldercare|B3|反对|2": "看多了就明白，换个漂亮说法而已，实际路径完全没有变化。",
};

// Phrase swaps: replace one occurrence in a specific row to reduce vocabulary overuse.
// Format: "topic|persona|stance|index": [ [find, replace], ... ]
const SWAPS = {
  "fertility|B1|反对|2": [["无脑跟着夸政策的人来来回回", "无脑跟着夸的账号说来说去"]],
  "fertility|B7|支持|1": [["这么一分析反而是最护女性和孩子的一条", "这么一看反而是最护女性和孩子的一条"]],
  "ai|B4|支持|2": [["这种典型的责任外推型选手", "这种就是典型的责任外推型玩家"]],
  "eldercare|B3|反对|2": [["共同点是都默认年轻人的时间是可以廉价交易的资源", "都默认年轻人的时间是可以廉价交易的资源"]],
};

const FILES = [
  { topic: "fertility", file: "new_low_quality_fertility.csv" },
  { topic: "ai", file: "new_low_quality_ai.csv" },
  { topic: "eldercare", file: "new_low_quality_eldercare.csv" },
];

const ROOT = path.join(__dirname, "..");

for (const { topic, file } of FILES) {
  const filePath = path.join(ROOT, file);
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  let extendCount = 0, swapCount = 0;
  for (const r of rows) {
    if (r.length < 5 || r[0] === "persona_id") continue;
    const key = `${topic}|${r[0]}|${r[1]}|${r[2]}`;
    const ext = EXTENSIONS[key];
    if (ext) {
      // Append extension. If content ends with 。 or !, add extension as a new sentence.
      let c = r[4];
      if (/[。！？]$/.test(c)) {
        r[4] = c + ext;
      } else {
        r[4] = c + "。" + ext;
      }
      extendCount++;
    }
    const swaps = SWAPS[key];
    if (swaps) {
      for (const [find, repl] of swaps) {
        if (r[4].includes(find)) {
          r[4] = r[4].replace(find, repl);
          swapCount++;
        }
      }
    }
  }
  fs.writeFileSync(filePath, toCsv(rows), "utf8");
  console.log(`${file}: extended ${extendCount} rows, swapped ${swapCount} phrases`);
}
