# LabWeb 简单汇报

## 1. Credamo对接问题

**A. 保持现状对接**：前后测在Credamo，行为数据在Supabase，靠uid合并；被试间分组在Credamo进行，url将分组参数（N条件*议题）传达给LabWeb。

**B. 前后测搬进LabWeb**：全部实验都用网页完成，被试间分组也需要在网页中进行；服务端生成签名令牌，随returnUrl带回Credamo填入隐藏题，用于监管被试是否完成实验。

## 2. 需要跟Credamo确认的内容

1. 外链跳转题能否插入答题者唯一ID到目标URL里？
2. 外链跳转题是否支持自定义变量从URL读取（用来接收returnUrl里带的verifyToken验证令牌，填进后测问卷的隐藏题里）？

## 3. N是否可以做成连续型变量？

如果被试间分组也用网页实现，那么可以将N设计成连续型变量。

## 4. 数据库具体上报

数据库为 Supabase（Postgres），共4张表，以 `uid` 关联（`experiments` 为主表，其余3张表通过 `uid` 外键级联关联）：

### experiments（主表，每个被试一行）

| 字段名 | 类型 | 说明 |
|---|---|---|
| uid | text（主键） | 被试唯一标识 |
| condition_n | int4 | 帖子数量条件（8 / 16 / 48） |
| topic | text | 议题标题（展示用） |
| topic_key | text | 议题标识（fertility / ai / eldercare） |
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

- 网站：https://illustrious-starburst-8f7b4f.netlify.app/
- 测试方法：以下链接均为完整的9种被试间条件（N × 议题）组合，可逐一打开测试；每条链接的 `uid` 各不相同，避免同一uid重复提交数据报错

| N | 议题 | 链接 |
|---|---|---|
| 8 | 生育 | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa01&n=8&topic=fertility |
| 8 | AI | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa02&n=8&topic=ai |
| 8 | 养老 | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa03&n=8&topic=eldercare |
| 16 | 生育 | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa04&n=16&topic=fertility |
| 16 | AI | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa05&n=16&topic=ai |
| 16 | 养老 | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa06&n=16&topic=eldercare |
| 48 | 生育 | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa07&n=48&topic=fertility |
| 48 | AI | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa08&n=48&topic=ai |
| 48 | 养老 | https://illustrious-starburst-8f7b4f.netlify.app/?uid=qa09&n=48&topic=eldercare |
