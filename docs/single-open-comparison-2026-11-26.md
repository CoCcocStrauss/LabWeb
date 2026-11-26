# 全局单开与盲态观点对比（2026-11-26，已发布）

依据labweb_2026_11_26.md。用户已确认边界：互动候选不足时从其余本次展示帖子补足到3条，单独记录fallback来源。

## 阅读交互

- 全页最多1条全文。打开新帖先以同一时间戳收起旧帖并结束其可见区间，再打开新帖；旧多开草稿恢复时只保留最后一条展开，不删除已有事件或时长。
- 左右半区及原序列的两两分区不变。取消独立Pair Row，半区使用普通双列row网格，无dense回填；右栏展开卡仅临时与原同排左卡交换order，使前缀为偶数格、展开占满原行，收起恢复顺序。唯一未填满的单格位于半区末行，不在中间留下单格空洞。
- 保留overflow-anchor:none、滚动条占位与绘制前瞬时位置补偿；操作实际内部滚动容器，不对固定壳错误调用window滚动。教程同步单开和淡已读状态。
- 当前协议的准备页从150000ms计时常量显示150秒；全局扫描发现的90秒仅在历史v2/v3兼容协议中，保留其真实时长与历史数据语义。

## 比较题与抽样

四帖盲评→观点对比→自由解释→博物馆题。比较页仅正文和内容A–F，桌面双列、手机单列，不渲染头像、昵称、认证、信源标签或互动状态。两个全局选择不能落到同帖，点同帖另一项会清空其原角色，手动继续。

最终转发随机最多3条，最终仅点赞补足互动贴到最多5条；参考立场用全部最终转发的多数，平票用前测核心题，3分则随机。优先对照为同立场、从未展开及从未点赞/转发；其次同立场最终未点赞/转发，再其次任意最终未互动。优先级写入controlRule。候选不足3条时从其余已展示帖子补足，candidateSources记fallback；如全部已互动而无对照，记录controlRule=unavailable和no_uninteracted_control，不虚构对照来源。

候选、顺序、参考立场、来源与抽样seed只生成一次并存入本地进度。刷新保留候选、顺序、已选答案和首次呈现时间，不重新抽签。服务端按seed和真实材料/最终互动重建抽样，拒绝替换候选、来源、参考立场、相同最佳最差、时长或ISO时间戳篡改。

## 保存与兼容

记录位于experiment_sessions.posttest.bestWorstComparison，含文档要求全部字段；另存version、seed、generatedAt、presentedAt、controlRule与fallbackReasons，用于复现与区分边界。answeredAt为ISO UTC字符串，durationMs为首次呈现到继续的墙钟时长，包含刷新/离开间隙；不影响正式阅读曝光统计。

questionnaireVersion沿用2026-11-25-v5。新阅读记录额外带reading_metrics.interactionVersion=single-open-comparison-v1，API要求此类记录必须完成比较题，并校验展开事件不并发。旧记录无此标记时仍兼容；已进入解释/提交的旧草稿不强行插入新题，未完成盲评的旧草稿自然进入新比较题。

现有submit_experiment_v7通过submit_experiment_v2原样写入posttest JSONB，可完整保留新字段，无需改表、增加RPC或运行迁移SQL。隔离数据库已回读确认新JSON字段完整；正式站新测试记录也已回读通过。

## 验证记录

- 54项单元/协议测试与生产构建通过，涵盖0/1/2/多/全转发、点赞补充上限、立场平票、取消互动、对照降级、fallback、选项互斥与服务端拒绝篡改。
- 8/24/48条逐卡展开/收起通过，另一半区不动、首帧位置偏差不超过4px，单开/刷新与末行空格检查通过；48条中下部连续按四列切换补核通过，自动收起与新展开时间戳一致。
- 两议题桌面与手机完整比较、互斥改选和真实刷新后恢复通过，最终隔离库保留5条候选及所有JSON字段；0/1条转发超时另验收通过，分别有2/1条fallback，均完成保存。
- 阅读可见区间、切屏、真实刷新、自动收起及结束收尾专项通过，桌面手动结束与手机超时结束均与隔离库保存记录逐段一致。
- Chromium测试包含模拟阅读时钟与文字解释，不代表真人录音或所有系统真机测试。证据目录：系统临时目录labweb-materials-20261125、labweb-dual-zone-20261126、labweb-comparison-edge-20261126、labweb-detail-visibility-qa。

## 正式站发布与核验

应用提交b823a8a已推送GitHub main，Netlify自动部署在https://myexperiment.cn生效。正式浏览器8条逐卡单开、首帧位置、无中间网格空洞及刷新验证通过。两议题桌面/手机各完成一轮新比较流程，并只读回查对应新测试记录：

- fertility：test_materials_live_fertility_1795688932348；5条候选（3转发、1仅点赞、1对照），8项要求字段完整；参考立场oppose（shared_majority），耗时1433ms，answeredAt=2026-11-26T10:31:10.962Z。
- ai：test_materials_live_ai_1795688984246；5条候选（3转发、1仅点赞、1对照），8项要求字段完整；参考立场support（shared_majority），耗时1382ms，answeredAt=2026-11-26T10:32:03.503Z。

核验reading_metrics.interactionVersion=single-open-comparison-v1、比较页刷新不重抽、互斥选择、完成状态、四帖盲评、左右全文阅读区间与4条互动动作。无新增SQL，现有posttest JSONB完整保留新字段。正式站证据在系统临时目录labweb-single-open-comparison-live-20261126和labweb-single-open-pin-live-20261126。仅操作新test_ UID，无历史数据修改。

48条人工QA：/?uid=test_bestworst_fertility_48_01&n=48&topic=fertility；/?uid=test_bestworst_ai_48_01&n=48&topic=ai。
