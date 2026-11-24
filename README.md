# LabWeb

2026-11-25：150秒阅读、可取消转发与四帖盲评已上线，正式站完整流程、数据库与私有录音保存验收通过；48条QA及发布证据见 [发布记录](docs/release-blinded-2026-11-25.md)。

2026-11-23：共用理由库、全部理由比较与实际互动内容比较已完成本机实现和隔离验证；使用独立新版本，旧会话保留。用户已执行增量SQL，新版已由GitHub main → Netlify正式发布并通过真实保存验收；见 [发布记录](docs/release-reasons-2026-11-23.md) 和 [实现验收](docs/reasons-protocol-2026-11-23.md)。

2026-11-22 最新发布：多卡跨列展开、桌面空白矩形回填、整卡切换、一次确定的单标签、五闪提醒与后台前测保存等已完成验收，按用户授权推送 main 并自动部署；见 [本轮发布记录](docs/release-inline-2026-11-22.md) 和 [本机验收过程](docs/inline-preview-2026-11-22.md)。Credamo HTML题接入按用户决定暂缓。

当前版本 `2026-11-21-v3` 已按更新的交接方案实现手机双列、桌面三至四列窄卡瀑布流、全文面板、顶部进度与限时提醒，并更新规则、反馈、麦克风许可及解释保存。实现与验证见 [瀑布流与流程验收记录](docs/masonry-protocol-2026-11-21.md)。线上 v3 迁移已就绪，真实数据库保存验收通过；本次按 GitHub main → Netlify 自动发布，见 [v3 发布记录](docs/release-v3-2026-11-22.md)。

此前 v2 的数据库迁移、真实保存及 GitHub → Netlify 发布记录见 [发布与验收记录](docs/release-2026-11-21.md)；v2 后测与录音的实现历史见 [新后测与录音记录](docs/new-protocol-2026-11-21.md)。v1／v2 已有会话继续使用各自版本，不映射新题。

上一版本的实现与验证见 [本地修改与验证记录](docs/local-update-2026-11-21.md)。此前 v2 数据库增量迁移已完成，下述旧部署信息保留供历史参考。

线上行为实验平台：模拟社交媒体信息流，用于研究被试在不同认知负荷（帖子数量 N）与不同议题下的浏览、点赞、转发行为。

- 技术栈：Next.js 14（App Router）+ TypeScript + Tailwind CSS，数据存储于 Supabase（Postgres）
- 当前问题与本次发布详情见 [研究进度与部署记录](docs/project-status-2026-11-20.md)
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

2026-11-20 已从 `CoCcocStrauss/LabWeb` 的 `main` 分支提交 `85905d9` 发布到
[opinionpolarization.netlify.app](https://opinionpolarization.netlify.app)，
[Netlify 管理入口](https://app.netlify.com/projects/opinionpolarization)。当前部署状态为 `ready`。
站点目前要求团队 SSO 登录；普通被试访问、线上数据库配置和完整问卷回跳仍待验证，尚不能视为已可正式投放。

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
当前使用现有 LabWeb Supabase 项目；连接地址以本地和服务端环境变量 `SUPABASE_URL` 为准。

Netlify 发布状态变为 Published 后，再测试阅读、转发、数据提交，并核对后台完成码。
`package.json` 中的 Netlify CLI 命令仅为本地手动部署的备用方式，GitHub 自动部署不使用它们。
