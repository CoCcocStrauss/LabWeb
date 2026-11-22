# Credamo HTML题、自定义变量与LabWeb接入方案

## 2026-11-22 最新决定

用户确认现阶段HTML题还不能接通，本轮只独立修改、测试网页，问卷嵌入、UID传递及完成后显示下一页，待HTML题可用再配置和联调。以下早期SSO、前后测位置等记录仅供历史参考；当前站点无需团队SSO，前后测已在LabWeb。

拟采用用户引用的[官方HTML题与JavaScript说明](https://help.credamo.app/web/#/4/416)中的`Credamo.hideNextBtn()`及`Credamo.showNextBtn()`：HTML题起始隐藏外层下一页，以同一UID轮询LabWeb的`/api/status`，仅在完整保存并返回completed:true后收起实验区，显示“本部分已完成，请点击下一页继续”及Credamo自己的下一页按钮。网络失败不得放行，不推测自动翻页接口，也不以iframe内的returnUrl跳转替代外层推进。当前未配置这些平台脚本，真实UID读取／持久化写法仍待HTML题联调；本轮工具未能直接读取该动态帮助页，不把用户提供的函数引用写成独立验证通过。

网页端已将最后按钮改为“提交”；在iframe中完成后显示点击外层下一页的提示，不执行iframe内returnUrl跳转。该显示逻辑可以本机普通iframe验证，但不能代替Credamo真实集成验收。

更新日期：2026年11月20日。此文件记录对接方案，不表示HTML题已经配置或联调成功。部署、研究问题及待修改项见 [项目进度记录](docs/project-status-2026-11-20.md)。

## 1. 已知依据与方案边界

用户提供的对接人沟通记录已确认：普通直接内嵌不能取得所需ID，应改用HTML题；通过HTML题和自定义变量在平台作答数据中保存UID，再给该题内的实验链接附上同一个UID，LabWeb同时将其存入自己的数据库。对接人同时说明，这只是改变获取ID的方式，其他内嵌行为与原方案一致。

对方提供的帮助链接：

- [帮助文档1938](https://www.credamo.com/#/help/web/4?page_id=1938)
- [帮助文档417](https://www.credamo.com/#/help/web/4?page_id=417)
- [自定义变量相关帮助1934](https://www.credamo.com/#/help/web/4?page_id=1934)

三页为动态路由页面，本次打开未返回可读正文，搜索也未取得具体API说明。因此下文的总体流程依据对接人原话和本地代码；HTML题读写自定义变量的实际语法、脚本权限及下一页控制尚未核验。本文件不假设某个未经确认的平台函数已经可用。

## 2. 双方需要保存的是同一份研究UID

LabWeb只检查URL中存在非空 `uid`，不要求它一定是Credamo原生账号ID。若平台不开放原生ID，可为每次问卷作答生成一个研究UID，并让问卷和LabWeb共同保存。

| 位置 | 建议名称或字段 | 要求 |
|---|---|---|
| Credamo自定义变量 | `lab_uid`（拟用名） | 写入当前作答记录，刷新、返回及重开HTML题时复用 |
| 实验链接参数 | `uid` | 值与 `lab_uid` 完全一致，通过URL编码传递 |
| Supabase四表关联 | `uid` | 已由现有提交接口保存，可与问卷导出数据合并 |
| Credamo完成标记 | `lab_completed`（拟用名） | 仅在服务器确认该UID完成后设为真；平台写法待核验 |

优先使用平台能提供并持久化的作答级唯一值；如果需要HTML自行生成，可以采用UUID。关键是“同一份问卷作答只生成一次、先存平台再载入实验”，而不是每次渲染iframe都重新生成。浏览器本地存储不能代替Credamo作答记录中的变量。

## 3. 建议的HTML题内嵌流程

1. 在当前问卷作答中读出研究UID；尚未设置时生成并写入自定义变量，随后复用。
2. 读取同一个UID，构造实验地址：`https://opinionpolarization.netlify.app/?uid=<URL编码后的研究UID>`。预览可用明确的测试UID，例如 `credamo_preview_20261120_001`；正式作答不能所有人共用这个固定值。
3. 在HTML题内部加载该地址。默认只传 `uid`，由LabWeb分配两个议题×三档负载的六种条件。
4. 被试完成任务后，LabWeb向 `/api/submit` 提交；数据库以该UID原子写入四张表，成功后iframe显示感谢页。
5. HTML题端拟定期查询 `https://opinionpolarization.netlify.app/api/status?uid=<同一研究UID>`；返回 `{"completed":true}` 后，写入完成标记并允许进入后测。具体如何保存标记、限制下一页，需按Credamo实际能力配置，当前尚未实现。
6. 导出问卷时确认 `lab_uid` 确实出现在每条作答记录中，再与Supabase的 `uid` 合并。仅在链接中出现UID、但导出数据没有UID，不算接入成功。

现有 `/api/status` 返回：完成为HTTP 200、`completed:true`；未完成为HTTP 200、`completed:false`；缺少UID为400；数据库请求失败为500。不能把网络失败当作完成。该接口已有跨域响应头，但Netlify整站SSO访问控制仍可能在请求到达应用前拦截。

### 内嵌时先不传returnUrl

现有结束页通过 `window.location.href` 跳转。在iframe里，这会改变iframe自己的地址，不能自动推动外层Credamo问卷进入下一页，还可能在frame里再次打开问卷。

因此HTML题内嵌方案先以“iframe保留感谢页、外层核验后继续问卷”为候选方案，不把 `returnUrl` 当成已经实现的内嵌完成通知。独立新窗口/新页面方案才按需要使用问卷续答地址。当前LabWeb没有向父页面发送完成事件的 `postMessage` 实现，也没有签名 `verifyToken` 回传；这些不应在文档中写成已完成功能。

### 前测与议题分配需要衔接

如果前测只展示随后将阅读的一个议题，则UID及议题条件必须在该前测之前准备好，供前测分支、HTML题和后测共同使用。不能由问卷和网页分别独立随机分配。

当前默认规则仍是LabWeb根据UID分配六种条件；如何在Credamo前测前复用该规则和保存议题变量，需结合平台能力另行确认。不得因为接入HTML题就默认为前后测迁入LabWeb，或将8／16／48改成连续负载。

## 4. 接入前仍需核实的具体能力

- HTML题是否允许所需JavaScript、iframe及跨域请求；自定义变量如何读取、设置并持久化到当前作答记录。
- 如何依据完成状态控制问卷继续；不能仅凭iframe加载或等待90秒就视为完成。
- 完成标记和UID是否确实进入数据导出，同一作答刷新、返回时UID是否保持不变，不同作答是否不同。
- 本次Netlify站点仍要求团队SSO登录，普通被试及嵌入页面的访问策略需先确认；iframe允许策略、手机端尺寸和滚动需实测。
- 入库失败、网页刷新、重复进入的处理仍存在待修改项；不能将换成HTML题视为这些问题已经解决。

## 5. 数据库字段参考

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

## 6. 联调验收

网站为 https://opinionpolarization.netlify.app；六种条件的独立QA链接见 [部署记录](docs/project-status-2026-11-20.md)。默认自动分组链接须带非空UID；单独访问根网址显示“无法开始实验”是当前参数检查的预期行为。

先用两条不同的测试作答跑通“HTML题保存UID → 加载实验 → 成功入库 → 完成状态查询 → 后测 → 导出合并”。核对两人UID不同、各自刷新UID不变、每个人的问卷记录与四表数据匹配。每次重做实验需更换测试UID。

错误页文案目前仍列出 `eldercare`，但正式参数校验只接受 `fertility` 和 `ai`，这处过时提示已列入待修改；本次没有改动网页组件。
