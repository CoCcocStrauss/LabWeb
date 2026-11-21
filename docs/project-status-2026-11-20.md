# 研究进度、部署记录与待讨论问题

更新时间：2026年11月20日，北京时间。本文以本次代码审查、材料校验和 Netlify 返回的部署记录为依据；线上运行效果尚待完整实验流程验证。本次更新范围为文档，未修改实验逻辑、站点访问权限或数据库。

## 已确认的研究与实验安排

研究关注信息负载增加后，内容质量、信源线索和立场一致性在信息判断中的相对权重如何变化，以及这种变化如何经由传播反馈形成观点聚集或群体分化。当前采用“Stage 1 行为实验 → 统计建模 → Stage 2 ABM”的路径，尚无实证结果。

| 项目 | 当前安排 |
|---|---|
| 正式议题 | AI 就业、育儿补贴，对应 `ai`、`fertility` |
| 负载条件 | 8／16／48 条，两个议题共六种被试间条件 |
| 材料 | 每议题48条，立场×信源×质量共8组，每组6条；保留字数阶梯 |
| 信源呈现 | 只有高信源展示认证或身份标签；高低质量均与高低信源交叉 |
| 任务 | 最长90秒；阅读过程中选择两条转发，满两条后可手动结束，时间到自动结束 |
| 问卷 | 前后测拟在 Credamo；题目、量尺和议题衔接仍需重新设计 |
| 分组 | 默认按 `uid` 确定性哈希分配六种条件；不保证六组人数严格相等 |
| 展示 | 每8条构成一个区组，每组含8类材料各1条；完整区组均衡，任意未读完的前缀不保证均衡 |
| Stage 2 | 以整轮信息浏览为可选更新单位；不同立场信源竞争为核心情境，模型与参数尚未定案 |

已审阅的两份 Excel 已同步到 `app/data/materials/ai.json` 和 `fertility.json`；本次再次运行 `npm run materials:check` 通过。旧 `eldercare.json` 仍保留为历史文件，不在正式议题注册表中。

## 本次部署记录

| 项目 | 已核实的信息 |
|---|---|
| 本地工作目录 | `/Users/jiayi/Desktop/Project/LabWeb` |
| GitHub 账号与仓库 | [CoCcocStrauss/LabWeb](https://github.com/CoCcocStrauss/LabWeb) |
| 当前推送地址 | `https://github.com/CoCcocStrauss/LabWeb.git` |
| 发布分支 | `main` |
| 发布提交 | `85905d92380f238a1fe64d9d8af7c28462c59565`，缩写 `85905d9` |
| Netlify 项目 | `opinionpolarization` |
| 站点地址 | https://opinionpolarization.netlify.app |
| 管理入口 | https://app.netlify.com/projects/opinionpolarization |
| 项目 ID | `58eb0215-57f6-4c47-ba32-0337f23f0298` |
| 部署 ID | `6afffbbe72ff4ef3d34d3a7c` |
| 固定版本地址 | https://6afffbbe72ff4ef3d34d3a7c--opinionpolarization.netlify.app |
| 发布状态 | `ready`，已是当前生产部署；2026-11-20 15:51:07 发布 |
| 构建与运行 | Next.js 14.2.35；Node.js 24；Netlify Next.js 适配器5.16.8；服务端函数已部署 |
| 构建设置 | 仓库根目录构建；命令 `npm run build`；发布目录 `.next` |
| 发布方式 | GitHub 推送触发 Netlify 构建，不需要在本机登录 Netlify CLI |
| 访问配置 | **当前要求所有访问者通过团队 SSO 登录，普通被试访问条件尚未满足** |

旧账号 `jiayicheng0611/LabWeb` 和旧站点 `illustrious-starburst-8f7b4f.netlify.app` 属于历史路径，不作为本次投放入口。本次文档更新尚未推送，不包含在上述已发布提交中。

### 数据库与配置的核验边界

本地 `.env.local` 已恢复并有后续更新，当前可读取的非密钥项如下：

| 项目 | 当前记录 |
|---|---|
| 本地配置指向的 Supabase URL | 见本地环境变量 `SUPABASE_URL` |
| 本地配置指向的项目 ref | `biobenawbymzsktnkmmx` |
| 对应控制台入口 | https://supabase.com/dashboard/project/biobenawbymzsktnkmmx |
| 服务端变量名 | `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`；后者也可填入服务端 `sb_secret_…` 密钥 |
| 数据表 | `experiments`、`actions`、`scroll_events`、`post_visibility` |
| 提交函数 | `submit_experiment`，初始化 SQL 的14个参数与当前提交接口一致 |
| 初始化脚本 | [supabase/schema.sql](../supabase/schema.sql)；新项目需在 SQL Editor 执行 |

这里记录的是本地配置指向，不能据此判断线上使用了同一项目。新项目的建表、线上两个变量及其 Functions 作用域均未核验。本次读取 Netlify 环境变量的操作被自动审批拒绝，原因是可能包含服务密钥且超出文档更新授权，之后未重试或改用其他方式提取线上变量。文档不包含任何密钥值。

此前本地 `npm run database:check` 能加载配置，但四表请求均未取得 HTTP 响应；同一执行环境对 Supabase、Netlify、npm 的直连域名解析失败，代理请求亦超时。这是历史网络检查结果，不能据此判定当前配置指向的项目有故障。当前配置的远程连通性、密钥有效性及线上入库仍未核验通过。

## 当前问题与影响

### 待修改清单

| 编号 | 项目 | 当前状态 |
|---|---|---|
| R01 | 教程“满两条自动完成”改为与“满两条后可手动结束”一致 | 用户已确认放入待修改；本轮未改代码 |
| R02 | 提交失败后的待提交数据保留、原记录重试及刷新恢复 | 用户已确认放入待修改；具体方案待讨论，本轮未实现 |
| R03 | 错误页仍展示 `eldercare`，应与正式 `fertility / ai` 取值一致 | 本次追加发现并记录为待修改，本轮未改代码 |

### 研究、接入与实现中的问题

下列“代码审查发现”尚未通过线上故障复现；“待讨论”不代表已决定修改。

| 类别 | 问题与依据 | 影响及待完成的确认 |
|---|---|---|
| 投放前阻碍 | Netlify 返回 `requiresSSOTeamLogin=true`，范围为 `all` | 需决定投放访问策略，并用未登录浏览器验证被试及 Credamo 能访问网页和接口；本次未修改权限 |
| 投放前阻碍 | 数据库建表、线上环境变量、实际入库和问卷继续流程未完成核验 | 发布成功只能证明部署完成；仍需完整走通一次测试实验，核对四表关联与后测续答 |
| 代码审查发现 | `TutorialPage.tsx` 写“转发满2条或倒计时结束自动完成”；`ExperimentPage.tsx` 实际要求满2条后点击结束 | 与已确认规则不一致，指导语需要讨论后统一为“满两条可手动结束” |
| 代码审查发现 | `EndPage.tsx` 提交失败后提示刷新；数据仅在 React 状态中，未发现本地待提交备份和重试按钮 | 刷新会重新进入教程，原行为记录可能丢失；需讨论保留记录、原数据重试及已入库但响应丢失的处理 |
| 代码审查发现 | `uid` 固定分组，但重新进入时重新抽样、随机排序；唯一主键阻止重复入库 | 不能把“分组稳定”理解为“实验过程可恢复”；需要决定已完成与中断被试的重入规则 |
| 埋点待验证 | 可见面积达到50%计时，布局稳定前800毫秒不记事件；未发现页面失焦/切后台的独立记录，倒计时按每秒递减 | 在小屏长帖、首屏不滚动、切后台等情境核对停留和90秒规则；可见时长只能作为加工的代理指标 |
| 测量待定 | 前后测重设计尚未完成，默认议题在网页入口才按 `uid` 分配 | 前测必须覆盖随后阅读的议题，前后测需同向可比；情景题、量尺及开放理由题待讨论 |
| Credamo接入 | 对接人已说明须通过HTML题和自定义变量保存、传递UID，普通内嵌无法直接取得所需ID | 总体路径已明确；实际变量语法、完成状态对下一页的控制、导出联结及iframe行为仍待联调 |
| 操作化待定 | “最想转发”“认同”“转发会展示给他人”在指导语中同时出现 | 转发包含认同及自我呈现动机，不能直接代替信念更新；需要统一任务措辞，并说明是否真的向他人展示 |
| 分析待定 | 质量×负载、信源×负载和立场一致性的联合模型未定；每人最多两次转发 | 分组整体效应与接触/选择机制分开解释；用组间交互直接比较权重变化，避免从少量选择给每个人硬分加工类型 |
| 投放方案待定 | 样本量、操纵评价、排除及缺失规则尚未冻结 | 不推翻8／16／48设置；用预实验及浏览记录说明实际负载与材料操纵表现，规则应在正式分析前确定 |
| 模拟待定 | Stage 2 更新函数、信源竞争、网络及反馈强度尚未定案 | 用 Stage 1 约束整轮选择和更新；区分数据估计参数与情境设定，比较局部趋同、态度强化及群体分化 |
| 版本记录 | 数据中有帖子ID和展示顺序，但未显式写入材料/实验程序版本 | 投放时保留发布 commit、JSON/Excel快照与前后测版本，便于之后按实际材料重建数据 |

### 对研究解释的约定

依赖信源并不自动等于非理性；本研究检验的是负载条件下质量与信源作用的相对变化。两类加工可以并存，暂不把 information contamination 作为已经成立的机制名称。

语料方向与前后测围绕同一核心命题统一。个人经历、政策执行信任等可以构成立场理由，不要求把自然表达强制拆成多个独立立场轴。当前已完成定向修订与同步，不在本次文档更新中继续改写语料。

共同趋同、局部观点聚集与群体间分化可以是相关过程。ABM 应分别报告组内一致性、组间距离及总体分布，以识别它们如何连接，而不是把“个体发生偏移”直接当作“必然形成两极”的证明。

理论沿用项目原有 ELM、HSM、有限容量/认知负荷和社会影响、观点动力学框架；具体文献见本地 `report/研究设计总览.md` 及 `Theory/`。本次没有重新决定统计模型或 ABM 形式。

## 上线后需核对的流程

1. 未登录 Netlify 的普通浏览器进入含 `uid` 的链接；六种 QA 条件均能打开。下列链接每次重跑应更换 `uid`，避免重复主键。
2. 分别测试两条转发后手动结束、0或1条转发时超时结束；核对指导语、结束原因和实际时间。
3. 确认提交返回成功，四表的 `uid` 正确关联，操作和停留记录与测试行为相符；完成码留在后台，不要求被试手动抄录。
4. HTML题内嵌时先验证完成状态查询和同一问卷进入后测，初版不传 `returnUrl`；独立页面方案才验证约1.2秒的回跳。现有 `window.location.href` 在iframe内只改变该frame，不能视为外层问卷已回跳。前后测与行为数据需能以同一 `uid` 合并。
5. 另行测试网络中断、刷新、重复进入及切后台；记录当前行为，讨论修正后再正式投放。

| 负载 | 议题 | QA 链接（重新测试请更换 uid） |
|---:|---|---|
| 8 | 育儿补贴 | https://opinionpolarization.netlify.app/?uid=qa_20261120_f08_r1&n=8&topic=fertility |
| 16 | 育儿补贴 | https://opinionpolarization.netlify.app/?uid=qa_20261120_f16_r1&n=16&topic=fertility |
| 48 | 育儿补贴 | https://opinionpolarization.netlify.app/?uid=qa_20261120_f48_r1&n=48&topic=fertility |
| 8 | AI就业 | https://opinionpolarization.netlify.app/?uid=qa_20261120_a08_r1&n=8&topic=ai |
| 16 | AI就业 | https://opinionpolarization.netlify.app/?uid=qa_20261120_a16_r1&n=16&topic=ai |
| 48 | AI就业 | https://opinionpolarization.netlify.app/?uid=qa_20261120_a48_r1&n=48&topic=ai |

正式链接只需 `uid`，按需加 URL 编码后的 `returnUrl`；手动 `n` 和 `topic` 是 QA 覆盖参数。测试数据用 `qa_` 前缀与正式数据区分。当前未实施正式被试投放。

## 相关实现

- [分组与入口](../app/page.tsx)、[哈希分组](../app/lib/conditionAssignment.ts)、[材料注册](../app/lib/materialsRegistry.ts)。
- [操作说明](../app/components/TutorialPage.tsx)、[正式实验](../app/components/ExperimentPage.tsx)、[提交与回跳](../app/components/EndPage.tsx)。
- [可见性记录](../app/lib/scrollTracker.ts)、[数据库只读检查](../scripts/check-database.cjs)、[建表及提交函数](../supabase/schema.sql)。
- [Credamo对接进度](../Credamo对接进度汇报.md)、[需求文档](../Spec.md)、[部署说明](../README.md)。
