# LabWeb

线上行为实验平台：模拟社交媒体信息流，用于研究被试在不同认知负荷（帖子数量 N）与不同议题下的浏览、点赞、转发行为。

- 技术栈：Next.js 14（App Router）+ TypeScript + Tailwind CSS，数据存储于 Supabase（Postgres）
- 完整需求与实现细节见 [`Spec.md`](./Spec.md)
- 议题材料的人设/身份设计说明见 `identity_mapping_*.md`

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 项目的 URL 与 service role key
npm run dev
```

## 部署

推荐部署到 Vercel，需在项目环境变量中配置 `.env.example` 中列出的变量，并在 Supabase 项目中执行 `supabase/schema.sql`。
