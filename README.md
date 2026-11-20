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

当前采用 GitHub 托管源码、Netlify 自动构建发布的方式，不需要在本机安装或登录 Netlify CLI。
使用 Node.js 24；`.nvmrc` 和 `netlify.toml` 已指定版本。Next.js 的页面和 `/api/submit`
由 Netlify 的 Next.js 适配器部署，不能把源码目录当成普通静态网页上传。

修改本地源码后提交并推送到原仓库：

```bash
cd /Users/jiayi/Desktop/Project/LabWeb
git add .
git commit -m "Update LabWeb"
git push origin main
```

GitHub 仓库为 `https://github.com/CoCcocStrauss/LabWeb`，所属账号为 `CoCcocStrauss`。
在 Netlify 网页选择 Add new project → Import an existing project → GitHub，授权后选择 `LabWeb` 仓库。
生产分支为 `main`，仓库根目录就是项目目录，Base directory 留空；
构建命令为 `npm run build`，发布目录为 `.next`，均已写入 `netlify.toml`。
关联完成后，每次推送到 `main` 都会触发 Netlify 构建，无需在本机执行发布命令。

发布前，在该 Netlify 项目的 Environment variables 中配置以下两个变量，
使用当前实验 Supabase 项目的真实值，并确保对 Functions 生效：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

不要给 service role key 加 `NEXT_PUBLIC_` 前缀，也不要写进 `netlify.toml`。
如果复用原 Supabase 项目，保留已有数据表；仅当数据库尚未初始化时执行 `supabase/schema.sql`。
缺少这两个变量时页面可能可以打开，但实验数据无法提交。

原项目的本地连接配置已恢复到 `.env.local`，该文件不提交到 Git。
以点开头的文件在 macOS Finder 中默认隐藏，在本文件夹按 Command+Shift+. 可显示。
如果改用新建的 Supabase 项目，用新项目的 URL 和服务端 Secret key 替换本地两个变量，
变量名继续使用 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
在本机运行 `npm run database:check` 可检查四张实验表的连接；检查不会返回已有记录，
不会写入数据或调用提交 RPC，也不会输出密钥。添加 `-- --config-only` 可仅检查本地配置。
本地 `.env.local` 不会自动成为 Netlify 的线上配置，发布时仍需在该项目设置中配置这两个变量。

Netlify 发布状态变为 Published 后，再测试阅读、转发、完成码和数据提交。
`package.json` 中的 Netlify CLI 命令仅为本地手动部署的备用方式，GitHub 自动部署不使用它们。
