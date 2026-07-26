# 实验网站需求文档（给 Claude Code）

## 项目概述

这是一个行为实验网站，模拟社交媒体信息流（类似知乎），研究认知负荷对信息选择的影响。被试在 90 秒内浏览帖子，选择 2 条转发。

已有一个 Next.js + TypeScript + Tailwind 项目（LabWeb），需要在此基础上重构。

---

## 技术栈

- **前端**：Next.js + TypeScript + Tailwind CSS（已有）
- **后端/数据库**：Supabase（Postgres），通过 Next.js 服务端 API 路由 `/api/submit` 写入（已从 Firebase Realtime Database 迁移）
- **部署**：Vercel（推荐）或其他静态托管

---

## URL 参数

网页通过 URL 参数接收被试 ID，条件分组默认由 LabWeb 自动完成：

```
https://yoursite.com/?uid=credamo_12345
```

| 参数 | 值 | 说明 |
|------|-----|------|
| `uid` | 字符串 | Credamo 被试唯一 ID（**必填，唯一必传参数**） |
| `n` | `8` / `16` / `48`（可选） | 帖子数量（认知负荷条件）。仅用于 QA 时强制指定某个条件，正式投放不需要传 |
| `topic` | `fertility` / `ai` / `eldercare`（可选） | 议题条件。仅用于 QA 时强制指定，正式投放不需要传 |
| `returnUrl` | 字符串（可选，需 URL 编码） | 实验数据提交成功后自动跳转回的地址（通常是 Credamo 的续答/后测链接）。只接受 `http`/`https` 绝对地址，非法值会被忽略。不提供则实验结束后停留在感谢页 |

`n × topic` 共构成 3×3=9 个被试间条件组合。**LabWeb 内置了基于 `uid` 的确定性哈希分组**（`app/lib/conditionAssignment.ts`，FNV-1a 哈希 mod 9）：

- 问卷平台（Credamo）**只需要传 `uid`**，不需要自己实现随机分组逻辑；
- 同一个 `uid` 无论刷新页面还是重新打开链接，永远分到同一组，避免中途换组打断实验或污染数据；
- 不同 `uid` 之间近似均匀散列到 9 个桶（用 9 万个模拟 uid 验证过，各桶占比误差 <1%），在 5000～10000 样本量下等价于随机分配；
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
3. 一个模拟的帖子卡片示例（静态展示，不可交互，只是让被试看到界面长什么样）
4. 底部按钮："我已了解，开始实验" → 跳转到实验页

**注意**：教程页不计时。

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
  content: string;               // 帖子正文（80-400字）
  quality: "high" | "low";       // 文本质量
  sourceLevel: "high" | "low";   // 信源可信度
  stance: "support" | "oppose";  // 立场
};
```

### 材料库

- 材料按议题分文件存储在 `app/data/materials/{topic}.json`（`fertility.json` / `ai.json` / `eldercare.json`），由 `app/lib/materialsRegistry.ts` 统一按 `topic` 参数查找加载，不硬编码
- 目前状态：`fertility.json`（三胎购房补贴）、`ai.json`（AI简历筛选）、`eldercare.json`（养老院年轻人入住计划）均已是正式材料，均按 `chatbot_generation_prompt.md` 的人设设计框架生成（先定人设列表，再按人设批量生成语料，最后随机分配 sourceLevel 并配对身份），具体人设与身份映射分别见 `identity_mapping_fertility.md` / `identity_mapping_ai.md` / `identity_mapping_eldercare.md`。**三个议题的内容均由AI按框架直接生成，正式投放前建议人工做一遍内容效度审阅**
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
- 每条 `sourceLevel="high"` 的帖子可以带一个 `identityDescription` 字段（专业身份文案），显示时会按 `topic` 去 `app/data/avatarPool.ts` 里对应议题的身份池匹配昵称+头像，未匹配到时落到通用兜底池

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

这确保被试无论读到哪里，已读部分在 8 个 cell 上都是均衡的。

### 信源线索设计

**高信源帖子**（`sourceLevel: "high"`）：
- 头像：真实人像照片（从 `/public/avatars/` 加载）
- 用户名：看起来真实的中文昵称（如"知秋观察""张哲 | Logic"）
- V 认证标：金色 V badge（已实现）
- **身份描述**（新增）：用户名下方一行灰色小字，如"复旦大学社会学系副教授""某三甲医院妇产科主治医师"
- 整体感觉：这是一个有专业背景、经过平台认证的用户

**低信源帖子**（`sourceLevel: "low"`）：
- 头像：纯色圆形 + 首字母（已实现）
- 用户名：随机字母数字串（如"xK7mQ2"）（已实现）
- 无 V 认证标
- 无身份描述
- 整体感觉：匿名用户，不知道背景

**身份描述池**（高信源专用，随机分配）：
```
[
  "清华大学计算机系副教授",
  "某互联网大厂高级算法工程师",
  "中科院自动化所研究员",
  "知名科技自媒体主编",
  "复旦大学社会学系副教授",
  "某三甲医院妇产科主治医师",
  "资深人力资源管理顾问",
  "某央企人工智能事业部总监"
]
```

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

---

## 数据收集（Supabase）

实验结束时，浏览器把数据 POST 到服务端 API 路由 `app/api/submit/route.ts`，
由服务端（持有 service role key）调用 Postgres 的 `submit_experiment` RPC 函数，
在一次事务内原子写入 4 张表。完整建表 SQL 见 `supabase/schema.sql`。

### 表结构

- **experiments**（主表，每个被试一行）：`uid`(主键) / `condition_n` / `topic` / `topic_key`(`fertility`/`ai`/`eldercare`，用于分析时按议题筛选) / `start_time_ms` / `end_time_ms` / `total_duration_ms` / `completion_code` / `end_reason` / `max_scroll_y` / `post_order`(数组)
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
1. Credamo 问卷中嵌入一个外链跳转（或 iframe），URL 携带 `uid` 参数
2. 被试完成实验后，由网页自动跳转回 Credamo（或通过接口对接通知完成状态），无需被试手动操作
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
│   ├── topics.ts               # 议题枚举（TOPIC_KEYS: fertility/ai/eldercare）
│   ├── materials/
│   │   ├── fertility.json      # 生育议题材料库（正式，三胎购房补贴）
│   │   ├── ai.json             # AI议题材料库（正式，AI简历筛选）
│   │   └── eldercare.json      # 养老议题材料库（正式，养老院年轻人入住计划）
│   ├── avatarPool.ts           # 高信源头像/昵称池 + 按议题拆分的身份描述映射
│   └── identityPool.ts        # 身份描述文本池
├── lib/
│   ├── supabaseAdmin.ts        # Supabase 服务端客户端（service role key，仅API路由可用）
│   ├── dataSubmit.ts           # 数据类型定义 + 客户端提交逻辑（fetch /api/submit）
│   ├── materialsRegistry.ts    # 按 topic 查找对应材料文件
│   ├── enrichPosts.ts          # 按 topic 给帖子分配展示昵称/头像
│   ├── blockRandomize.ts       # 分块随机化算法
│   ├── conditionAssignment.ts  # 按 uid 哈希自动分配 N×topic 9 条件（生成端只需传 uid）
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

## 给 Claude Code 的使用提示

1. 项目已有基础代码（LabWeb），在此基础上重构
2. 保留已有的 PostAvatar、GoldVBadge 等组件，只需调整和扩展
3. 新增 Firebase 集成、教程页、结束页、滚动追踪
4. 材料从 JSON 加载，不硬编码
5. 所有实验参数（n、uid、topic）从 URL 读取
6. 倒计时 90 秒（不是 3 分钟）
7. 优先保证功能正确性，样式可以后续微调
