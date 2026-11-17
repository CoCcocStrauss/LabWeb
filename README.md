# LabWeb

线上行为实验平台：模拟社交媒体信息流，用于研究被试在不同认知负荷（帖子数量 N）与不同议题下的浏览、点赞、转发行为。

- 技术栈：Next.js 14（App Router）+ TypeScript + Tailwind CSS，数据存储于 Supabase（Postgres）
- 完整需求与实现细节见 [`Spec.md`](./Spec.md)
- 议题材料的人设/身份设计说明见 `identity_mapping_*.md`

## 当前实验材料

正式议题为育儿补贴、AI就业；帖子数量为8、16、48条，共6种条件。
当前发布材料以项目上一级目录的两份已审阅Excel为准：
`语料信息表_育儿补贴议题.xlsx`、`语料信息表_AI就业议题.xlsx`。

修改Excel后运行 `npm run materials:import` 同步正文、研究属性、认证标签及昵称和头像配对，
再运行 `npm run materials:check` 核对材料、分组及呈现规则。
导入生成的 `app/data/materials/fertility.json` 和 `ai.json` 随代码发布，构建不依赖外部Excel文件。
早期的 `generate-materials-*.mjs` 用于旧议题，不应覆盖当前已审阅材料。

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 项目的 URL 与 service role key
npm run dev
```

## 部署

推荐部署到 Vercel，需在项目环境变量中配置 `.env.example` 中列出的变量，并在 Supabase 项目中执行 `supabase/schema.sql`。
