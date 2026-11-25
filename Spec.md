# 实验网站需求与实现记录

2026-11-25新版语料：以项目上级目录两份审核Excel为准，育儿补贴改为每月800元，AI议题改为辅助医疗诊断，内部topic键和既有题目ID不变。版本 `2026-11-25-v5`，独立v7保存函数；旧版材料进度保留并提示联系实验员，不静默升版。盲评保留头像昵称但隐藏认证、标签和金边。详见 [验收记录](docs/materials-2026-11-25.md)。

2026-11-25本地待发布：规则改为三步分页与轻动效，阅读返回时显示3秒轻提示；rules/reading_metrics仍用JSONB保存步骤与切屏汇总，旧会话兼容，不改150秒截止时间。见 [实现记录](docs/blinded-protocol-2026-11-24.md)。

2026-11-25：150秒阅读、可取消转发与四帖盲评已上线，正式站完整流程、数据库与私有录音保存验收通过；48条QA及发布证据见 [发布记录](docs/release-blinded-2026-11-25.md)。

2026-11-23：共用理由库、全部理由比较与实际互动内容比较已完成本机实现和隔离验证；使用独立新版本，旧会话保留。用户已执行增量SQL，新版已由GitHub main → Netlify正式发布并通过真实保存验收；见 [发布记录](docs/release-reasons-2026-11-23.md) 和 [实现验收](docs/reasons-protocol-2026-11-23.md)。

2026-11-22 最新发布：多卡跨列展开、桌面空白矩形回填、整卡切换、一次确定的单标签、五闪提醒与后台前测保存等已完成验收，按用户授权推送 main 并自动部署；见 [本轮发布记录](docs/release-inline-2026-11-22.md) 和 [本机验收过程](docs/inline-preview-2026-11-22.md)。Credamo HTML题接入按用户决定暂缓。

当前版本 `2026-11-21-v3` 按更新的交接方案实现手机双列、桌面三至四列窄卡瀑布流及配套流程；当前需求以 [修改交接](LabWeb_修改交接.md) 为准，实现与验证见 [瀑布流与流程验收记录](docs/masonry-protocol-2026-11-21.md)。线上迁移与真实保存验收已通过；本次 GitHub → Netlify 发布见 [v3 发布记录](docs/release-v3-2026-11-22.md)。

此前 v2 的数据库增量迁移、真实保存及 GitHub → Netlify 发布记录见 [发布与验收记录](docs/release-2026-11-21.md)。v2 后测与录音实现历史见 [新后测与录音记录](docs/new-protocol-2026-11-21.md)。旧版会话继续使用原版本，不映射新题。

上一版本的规则与验证见 [本地修改与验证记录](docs/local-update-2026-11-21.md)。以下2026-11-20记录中的三页流程和“前后测在外部平台完成”等内容保留为旧版设计，不代表当前本地实现。该历史记录不包含本轮发布验收。

更新日期：2026年11月20日。正式范围为两个议题、六种条件；最新部署与待修改项见 [项目进度记录](docs/project-status-2026-11-20.md)，Credamo 接入方案见 [对接文档](Credamo对接进度汇报.md)。本文描述已确认规则，具体文案与实现差异另行列为待修改，不表示本轮已改代码。

## 项目概述

这是一个行为实验网站，模拟社交媒体信息流（类似知乎），研究认知负荷对信息选择的影响。被试在 90 秒内浏览帖子，选择 2 条转发。

已实现 Next.js + TypeScript + Tailwind 项目（LabWeb），后续在现有项目上迭代。

---

## 技术栈

- **前端**：Next.js + TypeScript + Tailwind CSS（已有）
- **后端/数据库**：Supabase（Postgres），通过 Next.js 服务端 API 路由 `/api/submit` 写入（已从 Firebase Realtime Database 迁移）
- **部署**：GitHub `CoCcocStrauss/LabWeb` → Netlify `opinionpolarization`，同时部署页面及服务端 API

---

## URL 参数

网页通过 URL 参数接收被试 ID，条件分组默认由 LabWeb 自动完成：

```
https://yoursite.com/?uid=credamo_12345
```

| 参数 | 值 | 说明 |
|------|-----|------|
| `uid` | 字符串 | 双方共同保存的研究 UID（**必填，唯一必传参数**）；不要求一定是 Credamo 原生账号ID |
| `n` | `8` / `16` / `48`（可选） | 帖子数量（认知负荷条件）。仅用于 QA 时强制指定某个条件，正式投放不需要传 |
| `topic` | `fertility` / `ai`（可选） | 议题条件。仅用于 QA 时强制指定，正式默认流程不需要传 |
| `returnUrl` | 字符串（可选，需 URL 编码） | 实验数据提交成功后自动跳转回的地址（通常是 Credamo 的续答/后测链接）。只接受 `http`/`https` 绝对地址，非法值会被忽略。不提供则实验结束后停留在感谢页 |

`n × topic` 共构成 3×2=6 个被试间条件组合。**LabWeb 内置了基于 `uid` 的确定性哈希分组**（`app/lib/conditionAssignment.ts`，FNV-1a 哈希 mod 6）：

- 问卷平台（Credamo）**只需要传 `uid`**，不需要自己实现随机分组逻辑；
- 同一个 `uid` 无论刷新页面还是重新打开链接，永远分到同一组，避免中途换组打断实验或污染数据；
- 不同 `uid` 散列到6个条件，当前校验确认1万个测试UID分配稳定且六种条件均可到达；这不保证实际样本配额相等，正式投放需核对组间人数及分组平衡；
- 如需 QA 时定向测试某一具体组合，可以同时手动附加 `n` 与 `topic`（两者必须同时提供且合法，否则视为无效链接），例如 `?uid=test001&n=16&topic=ai`；正式投放链接不要带这两个参数。

如果 `uid` 缺失，或手动指定了 `n`/`topic` 但取值不合法，显示错误提示页。

---

## 页面流程（共 3 页）

### 第 1 页：教程页

**目的**：让被试熟悉界面操作，确保他们理解任务。

**内容**：
1. 标题："实验操作说明"
2. 说明文字：
   - "接下来你将看到一个模拟的社交媒体页面，上面有若干条帖子。"
   - "你的任务是：在 90 秒内浏览这些帖子，选择 **2 条**你最想转发的内容。"
   - "你可以通过点击帖子右下角的「转发」按钮来选择转发。转发前会有确认弹窗。"
   - "你也可以点击「点赞」按钮，但这不计入转发次数。"
   - "转发满 2 条后，点击底部的「结束实验」按钮即可完成。"
   - "如果 90 秒倒计时结束时你尚未转发满 2 条，实验将自动结束。"
3. 高、低信源各一个练习卡片，可点赞及练习转发；完成一次转发练习后才可进入正式任务
4. 底部按钮："我已了解，开始实验" → 跳转到实验页

**注意**：教程页不计时。

**待修改 R01**：现有教程组件仍写“转发满2条或倒计时结束自动完成”，与上述手动结束规则不一致；用户已要求列入待修改，本轮未改组件。

### 第 2 页：正式实验页

**核心页面，详见下方各节。**

### 第 3 页：结束页

**内容**：
1. "实验结束，感谢参与！"
2. 提交成功后：
   - 若URL带有合法的 `returnUrl` 参数，提示"您的数据已成功保存，即将跳转回问卷…"，约1.2秒后自动 `location.href` 跳转过去（用于回到 Credamo 继续后测）
   - 若没有 `returnUrl`，提示"您的数据已成功保存，可以关闭此页面"
3. 后台仍生成 6 位完成码并写入 Supabase（与 uid 绑定，供内部核验使用），但**不在页面上展示，也不要求被试手动抄录**
4. 不显示任何实验数据

> 变更说明：原方案中"被试记录完成码后手动回到 Credamo 填入"的环节已取消，改为通过 `returnUrl` 参数实现自动跳转。LabWeb 不关心 `returnUrl` 里具体是什么地址/机制（原问卷续答链接、Credamo提供的专用回跳链接、或独立的后测问卷链接均可），由 Credamo 侧决定跳转目标并负责把它作为 `returnUrl` 参数拼进最初跳出的链接里；LabWeb只负责"提交成功后跳转过去"。

---

## 实验页详细设计

### 帖子数据结构

```typescript
type PostItem = {
  id: string;                    // 唯一标识，如 "support_high_high_01"
  content: string;               // 帖子正文，长度以已审阅材料及字数阶梯为准
  quality: "high" | "low";       // 文本质量
  sourceLevel: "high" | "low";   // 信源可信度
  stance: "support" | "oppose";  // 立场
};
```

### 材料库

- 正式材料存储在 `app/data/materials/fertility.json` 和 `ai.json`，由 `app/lib/materialsRegistry.ts` 注册；`eldercare.json` 仅为历史保留文件，不参与正式分配
- 当前议题为每名儿童每月2000元、直至18岁的育儿补贴是否明显提高生育率，以及AI对就业的影响。材料以项目上一级的两份已审阅Excel为准，通过 `npm run materials:import` 导入；原人设映射文档和旧生成脚本仅供历史参考
- 按 2×2×2 = 8 个 cell 分组，每个 cell 至少 6 条帖子（支撑 N=48 时每 cell 6 条）
- JSON 结构：

```json
{
  "topic": "AI与就业",
  "topicDescription": "人工智能是否会导致大量失业？",
  "tags": ["人工智能", "就业"],
  "materials": {
    "support_high_high": [
      { "id": "shh_01", "content": "...", "quality": "high", "sourceLevel": "high", "stance": "support" },
      { "id": "shh_02", "content": "...", ... },
      ...
    ],
    "support_high_low": [...],
    "support_low_high": [...],
    "support_low_low": [...],
    "oppose_high_high": [...],
    "oppose_high_low": [...],
    "oppose_low_high": [...],
    "oppose_low_low": [...]
  }
}
```

- cell 命名规则：`{stance}_{source}_{quality}`
- 每条 `sourceLevel="high"` 的帖子有两个可选标签字段：
  - `identityLabel`：现实职业身份（身份类标签，灰色小 pill），如"妇产科副主任医师"
  - `platformLabel`：平台身份/影响力（平台类标签，蓝色小 pill），如"知乎三孩话题优质答主"
  - 每位认证用户最多展示2个标签，具体标签沿用已审阅Excel；高低质量材料均可有高信源标签
  - 优先使用每条材料的 `sourceCandidates` 昵称—头像配对；旧身份池仅作缺少候选配对时的兼容回退

### 帖子加载逻辑（分块随机化）

根据 URL 参数 `n` 决定加载数量：

```
N=8:  1 个 block × 8 条（每 cell 1 条）
N=16: 2 个 block × 8 条（每 cell 2 条）
N=48: 6 个 block × 8 条（每 cell 6 条）
```

每个 block 从 8 个 cell 中各随机抽 1 条（不重复）。

排序规则：
1. Block 之间顺序随机
2. Block 内部 8 条顺序随机
3. 不做任何"优先呈现"

每个完整读到的8条区组在8个cell上均衡；尚未读完的区组、实际可见集合和转发前接触集合不保证均衡。随机顺序降低系统性的位置关联，不保证每人接触范围相同。

### 信源线索设计

**高信源帖子**（`sourceLevel: "high"`）：
- 头像：真实人像照片（从 `/public/avatars/` 加载）
- 用户名：看起来真实的中文昵称（如"知秋观察""张哲 | Logic"）
- V 认证标：金色 V badge（已实现）
- **身份描述**（新增）：用户名下方一行灰色小字，如"复旦大学社会学系副教授""上海市第一妇婴保健院妇产科主治医师"
- 整体感觉：这是一个有专业背景、经过平台认证的用户

**低信源帖子**（`sourceLevel: "low"`）：
- 头像：纯色圆形 + 首字母（已实现）
- 用户名：随机字母数字串（如"xK7mQ2"）（已实现）
- 无 V 认证标
- 无身份描述
- 整体感觉：匿名用户，不知道背景

身份描述沿用每条已审阅材料的标签，不独立随机抽取不相干职业。低信源不展示认证、身份标签或真实人像，研究用的立场、质量、信源编码仍保留在元数据中。

### 帖子卡片 UI

每张卡片包含：
1. 左侧：头像（高信源=照片，低信源=字母圆形）
2. 右上：用户名 + V 标（如有）
3. 用户名下方：身份描述（高信源才有，灰色小字）
4. 正文内容
5. 右下角：转发按钮 + 点赞按钮

**不要有**：
- 不要有转发数/点赞数（避免额外外周线索混淆）
- 不要有评论功能
- 不要有红/蓝等颜色差异（所有卡片样式统一，只有信源线索不同）

### 交互行为

**转发**：
- 点击"转发"→ 弹出确认弹窗"是否确认转发？"→ 确认/取消
- 已转发的帖子显示"已转发"（红色，不可再次转发）
- 最多转发 2 条
- 转发满 2 条后，底部"结束实验"按钮激活

**点赞**：
- 点击切换点赞/取消点赞（toggle）
- 不限次数
- 纯行为记录，不影响实验流程

**倒计时**：
- 90 秒倒计时，显示在底部状态栏（格式 01:30）
- 倒计时结束时自动终止实验（无论是否转发满 2 条）
- 倒计时结束时也写入 Supabase 并显示结束页

### 底部状态栏

固定在屏幕底部：
```
[ 剩余时间 01:15 ]  [ 已转发 1/2 ]  [ 结束实验（按钮） ]
```

---

## 网络加载恢复

动态分包加载时显示可见提示，12秒后给出手动重载入口，加载失败时立即显示重载入口；原生同页链接保留URL与UID，不清空本地进度、不重置实验截止时间，不自动刷新。服务端输出在JavaScript未运行时也可显示。这不能替代网络线路不通时的部署入口调整。本项为11月25日本地待发布修改。

## 滚动追踪

使用 Intersection Observer API 追踪每条帖子的可见性：

```typescript
type ScrollEvent = {
  postId: string;
  action: "enter_viewport" | "leave_viewport";
  timestamp: number;     // Date.now()
  scrollY: number;       // window.scrollY
};
```

- 当帖子 >= 50% 面积进入可视区域时记录 `enter_viewport`
- 当帖子离开可视区域时记录 `leave_viewport`
- 实验结束时汇总每条帖子的总可见时长（毫秒）

新版页内展开追踪（11月25日本地修复，待发布）：短卡曝光仍存`post_visibility`；展开正文实际可见区间单独存`reading_metrics.detailIntervals`，每段含`postId/startMs/endMs/durationMs`（Unix毫秒，兼容保留`startedAt/endedAt`）。滚出、切屏、收起及结束均关闭当前段，恢复可见时另起一段，与同帖短卡时段不重叠。细则及验收见 [实现记录](docs/blinded-protocol-2026-11-24.md)。

---

## 数据收集（Supabase）

实验结束时，浏览器把数据 POST 到服务端 API 路由 `app/api/submit/route.ts`，
由服务端（持有 service role key）调用 Postgres 的 `submit_experiment` RPC 函数，
在一次事务内原子写入 4 张表。完整建表 SQL 见 `supabase/schema.sql`。

### 表结构

- **experiments**（主表，每个被试一行）：`uid`(主键) / `condition_n` / `topic` / `topic_key`(正式取值 `fertility`/`ai`；SQL仍兼容历史 `eldercare`) / `start_time_ms` / `end_time_ms` / `total_duration_ms` / `completion_code` / `end_reason` / `max_scroll_y` / `post_order`(数组)
- **actions**：`uid`(外键) / `type` / `post_id` / `timestamp_ms` / `order_num` / `stance` / `source_level` / `quality` / `content` / `char_count`
- **scroll_events**：`uid`(外键) / `post_id` / `action` / `timestamp_ms` / `scroll_y`
- **post_visibility**：`uid`(外键) / `post_id` / `total_visible_ms` / `first_seen_at_ms`

### 安全策略

- 四张表均开启 RLS，且不添加任何 policy：`anon`/`authenticated` 角色完全无读写权限
- 写入只能通过服务端 `SUPABASE_SERVICE_ROLE_KEY` 调用 RPC 完成（该 key 只存在于服务端环境变量，不会打进浏览器代码）
- `experiments.uid` 主键约束 + RPC 单事务，天然保证"每个 uid 只能成功提交一次、且四张表要么都写成功要么都不写"
- `app/api/submit/route.ts` 内还做了服务端字段校验（`condition_n` 取值、`end_reason` 取值、`share` 类型 action 数量 ≤ 2 等），防止篡改后的payload写入

---

## 不在网页中实现的功能

以下功能由 Credamo 问卷平台负责，网页不需要实现：

- 知情同意
- 立场前测（量表）
- 态度后测（量表）
- 人口学统计信息收集

Credamo 与网页的对接方式：
1. 根据对接人的说明，通过HTML题和自定义变量保存研究UID，再给HTML题内的实验链接附上同一个 `uid`；普通直接内嵌无法直接取得所需ID
2. HTML题内嵌方案拟用 `/api/status?uid=...` 核验完成后继续同一问卷；平台变量读写语法及下一页控制仍待确认。独立跳转方案才按需要使用 `returnUrl`。现有代码在iframe内只会导航当前frame，不能据此声称已实现顶层问卷回跳
3. 数据分析时通过 `uid` 将 Credamo 问卷数据和 Supabase 行为数据合并

---

## 文件结构建议

```
app/
├── page.tsx                    # 路由入口，读取 URL 参数，决定显示哪个页面
├── api/
│   └── submit/route.ts         # 服务端提交接口：校验payload后写入Supabase
├── components/
│   ├── TutorialPage.tsx        # 教程页
│   ├── ExperimentPage.tsx      # 正式实验页
│   ├── EndPage.tsx             # 结束页（提交数据，不展示完成码）
│   ├── PostCard.tsx            # 单条帖子卡片
│   ├── PostAvatar.tsx          # 头像组件（高/低信源）
│   ├── GoldVBadge.tsx          # V 认证标
│   ├── CountdownBar.tsx        # 底部状态栏
│   └── ShareModal.tsx          # 转发确认弹窗
├── data/
│   ├── topics.ts               # 正式议题枚举（TOPIC_KEYS: fertility/ai）
│   ├── materials/
│   │   ├── fertility.json      # 正式：育儿补贴
│   │   ├── ai.json             # 正式：AI就业
│   │   └── eldercare.json      # 历史保留，不参与分配
│   ├── avatarPool.ts           # 高信源头像/昵称池 + 按议题拆分的身份描述映射
│   └── identityPool.ts        # 身份描述文本池
├── lib/
│   ├── supabaseAdmin.ts        # Supabase 服务端客户端（service role key，仅API路由可用）
│   ├── dataSubmit.ts           # 数据类型定义 + 客户端提交逻辑（fetch /api/submit）
│   ├── materialsRegistry.ts    # 按 topic 查找对应材料文件
│   ├── enrichPosts.ts          # 按 topic 给帖子分配展示昵称/头像
│   ├── blockRandomize.ts       # 分块随机化算法
│   ├── conditionAssignment.ts  # 按 uid 哈希自动分配 N×topic 6 条件（生成端只需传 uid）
│   └── scrollTracker.ts        # 滚动追踪 hook
├── globals.css
├── layout.tsx
public/
├── avatars/                    # 高信源头像图片
│   ├── v1.jpg
│   ├── v2.jpg
│   └── ...
supabase/
└── schema.sql                  # 建表 SQL（在Supabase SQL Editor中执行）
```

---

## 关键算法：分块随机化

```typescript
function blockRandomize(materials: MaterialsByCell, n: number): PostItem[] {
  const numBlocks = n / 8; // n 必须是 8 的倍数
  const cells = Object.keys(materials); // 8 个 cell
  const result: PostItem[] = [];

  for (let b = 0; b < numBlocks; b++) {
    const block: PostItem[] = [];
    for (const cell of cells) {
      // 从该 cell 中随机取 1 条（不与之前 block 重复）
      const available = materials[cell].filter(
        p => !result.some(r => r.id === p.id)
      );
      const pick = available[Math.floor(Math.random() * available.length)];
      block.push(pick);
    }
    // Block 内部随机排序
    shuffleArray(block);
    result.push(...block);
  }

  return result;
}
```

---

## 后续实现约定

1. 项目已有基础代码（LabWeb），在此基础上重构
2. 保留已有的 PostAvatar、GoldVBadge 等组件，只需调整和扩展
3. 当前使用 Supabase 服务端接口；教程、结束页及滚动追踪已实现，后续修改需先确认范围
4. 材料从 JSON 加载，不硬编码
5. `uid` 从URL读取；默认分组由uid计算，手动覆盖时 `n` 和 `topic` 须同时合法
6. 倒计时 90 秒（不是 3 分钟）
7. 优先保证功能正确性，样式可以后续微调
