# LabWeb 简单汇报

更新日期：2026年11月20日。详细部署与待修改项见 [项目进度记录](docs/project-status-2026-11-20.md)。

## 1. 当前实验与部署

正式议题为AI就业、育儿补贴；8／16／48条共六种条件，最长90秒。阅读过程中转发两条后可手动结束，时间到自动结束。每议题48条已审阅材料已与Excel同步。

GitHub仓库为 `CoCcocStrauss/LabWeb`，`main` 分支提交 `85905d9` 已发布到 https://opinionpolarization.netlify.app。当前Netlify访问配置要求团队SSO登录；普通被试访问及数据库、问卷联调尚未验证通过。

## 2. Credamo接入

根据对接人反馈，采用HTML题和自定义变量保存研究UID，再将同一UID附到内嵌实验链接，双方据此存储和合并数据。默认六条件分组在LabWeb按UID计算；前后测保留在Credamo，具体题目及议题分支衔接待设计。

内嵌方案拟以现有 `/api/status` 查询完成状态后继续问卷；平台变量读写和下一页控制尚未核验。现有 `returnUrl` 在iframe内只导航当前frame，不等于已实现外层问卷回跳；签名验证令牌和 `postMessage` 均未实现。详见 [Credamo接入方案](Credamo对接进度汇报.md)。

## 3. 待修改与待设计

教程的自动结束表述、提交失败后的数据保留与恢复已由用户确认放入待修改；错误页旧 `eldercare` 提示也已记录。前后测、指导语、分析计划及ABM规则仍需讨论。本次只更新文档，未修改网页逻辑；8／16／48保持不变。

## 4. 数据库具体上报

数据库为 Supabase（Postgres），共4张表，以 `uid` 关联（`experiments` 为主表，其余3张表通过 `uid` 外键级联关联）：

### experiments（主表，每个被试一行）

| 字段名 | 类型 | 说明 |
|---|---|---|
| uid | text（主键） | 被试唯一标识 |
| condition_n | int4 | 帖子数量条件（8 / 16 / 48） |
| topic | text | 议题标题（展示用） |
| topic_key | text | 正式议题为 fertility / ai；SQL保留 eldercare 历史兼容值 |
| start_time_ms | int8 | 实验开始时间戳 |
| end_time_ms | int8 | 实验结束时间戳 |
| total_duration_ms | int4 | 实验总时长 |
| completion_code | text | 完成码 |
| end_reason | text | 结束方式（manual 手动结束 / timeout 超时结束） |
| max_scroll_y | int4 | 最大滚动深度 |
| post_order | _text（数组） | 帖子实际展示顺序 |
| created_at | timestamptz | 记录创建时间 |

### actions（被试行为明细，每次操作一行）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | int8（主键，自增） | 行ID |
| uid | text（外键） | 关联 experiments.uid |
| type | text | 行为类型（share 转发 / like 点赞 / unlike 取消点赞 / user_post 自主发帖） |
| post_id | text | 关联的帖子ID |
| timestamp_ms | int8 | 操作时间戳 |
| order_num | int4 | 转发序号（第几次转发） |
| stance | text | 帖子立场（支持/反对） |
| source_level | text | 信源等级（高/低） |
| quality | text | 内容质量（高/低） |
| content | text | 内容文本（仅 user_post 使用） |
| char_count | int4 | 字数（仅 user_post 使用） |

### scroll_events（帖子进出可视区事件，每次进出一行）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | int8（主键，自增） | 行ID |
| uid | text（外键） | 关联 experiments.uid |
| post_id | text | 帖子ID |
| action | text | 事件类型（enter_viewport 进入可视区 / leave_viewport 离开可视区） |
| timestamp_ms | int8 | 事件时间戳 |
| scroll_y | int4 | 当时滚动深度 |

### post_visibility（每条帖子的可见时长汇总，每人每帖一行）

| 字段名 | 类型 | 说明 |
|---|---|---|
| id | int8（主键，自增） | 行ID |
| uid | text（外键） | 关联 experiments.uid |
| post_id | text | 帖子ID |
| total_visible_ms | int4 | 该帖子累计可见时长 |
| first_seen_at_ms | int8 | 该帖子首次进入可视区的时间戳 |

## 5. 测试实验网站

- 网站：https://opinionpolarization.netlify.app/
- 六种QA条件及测试流程见 [部署记录](docs/project-status-2026-11-20.md)。每次重做使用新的 `qa_` 测试UID。
- 默认入口至少包含 `uid`；定向QA时同时提供合法的 `n` 与 `topic`。空参数根网址目前显示“无法开始实验”，属于预期行为。
- 完成码留在后台，不要求被试抄录。内嵌后继续问卷的方式需要与Credamo完成状态查询一起联调。
