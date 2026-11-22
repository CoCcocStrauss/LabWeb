# 2026-11-22 多卡跨列展开与单标签发布

用户授权在正式站测试当前版本，按 GitHub main 推送触发 Netlify 自动部署。正式地址 https://myexperiment.cn，Netlify 项目 opinionpolarization。以 test_ 开头的 UID 标识本轮测试；这些记录使用正式数据库，分析时应按 UID 前缀筛除，不会自动隔离或自动删除。原有 qa_ 前缀的历史测试记录也须排除。

## 发布范围

- 手机双列，展开卡独占整行，后续顺延；桌面三／四列，展开占相邻两列，以空白矩形回填最靠上的可容纳位置，同高时优先靠近原列。
- 多张卡片独立保持展开；整卡非操作区统一切换展开／收起，点赞转发整行除外。拖动、滚动、选字防误触，重排后滚动补偿；原详情面板代码保留。
- 两份更新工作簿的短标签已导入：AI26、育儿补贴20个标签单元格。高信源两类标签各50%显示一种，一次确定并保存；低信源无认证和标签。标签放在昵称下方并与昵称对齐，教程相同。
- 删除独立前测保存页，在任务说明后台保存；教程布局、规则理解说明、理解反馈、30秒五闪、去浏览进度和固定议题标题调整一并发布。
- Credamo 外层问卷集成继续暂缓，等 HTML 题可用后配置、联调。

## 数据与验证

不需要新增 SQL。现有 presented_posts 和 reading_metrics JSON 保存实际标签及 packingVersion=free-rect-top-first-v1，以及多卡展开、跨列几何和独立全文可见时长。兼容旧会话、旧材料标签和旧版验证，不修改或转换既有记录。

发布前25组单元测试、5组本机隔离HTTP、生产构建编译／类型／Lint通过；两议题各48条与最新工作簿一致。真实Chromium检查320、390、667、1366、1440px视口，48条无丢失、无重叠／越界，多卡保持、热区隔离、滚动补偿、刷新和窗口切换通过。隔离数据库完整作答保存通过，详见 [本机过程记录](inline-preview-2026-11-22.md)。这些不等同实体 iOS／Android 或 Credamo 集成验收。

## 发布状态

- GitHub main 代码提交：`a3a6895fb4c493494ee6fa1e8db729133107a918`，已推送。
- Netlify 生产部署：`6b028e3100e7bc9010ef890a`，ready，2026-11-22北京时间14:40发布至 https://myexperiment.cn，部署对应上述提交，密钥扫描通过。
- 正式域名 Chromium 完整流程：`test_browser_inline_20261122_1795329694428`。48条育儿补贴材料，教程独立展开、正式页整卡展开／收起、两张全文保持、点赞转发操作隔离、四／三／双列切换、无丢失／重叠／越界、手机全宽、刷新后标签及截止时间稳定、转发满两条后的结束按钮、完整后测与最终完成均通过。
- 正式库只回读上述测试UID：前测5题、后测3题、48条presented_posts、教程标签、reading_metrics与客户端最终提交完全一致，completed_at与explanation_saved_at均已保存，实际转发2条、结束后无遗留展开ID；packingVersion和单标签版本正确。
- 正式域名API和私有音频：`test_api_inline_20261122_1795329693722`，48条AI就业材料。前测提前保存、解释提前保存、标签及各JSON字段回读、最终提交与幂等重试通过；关联行数experiments 1、experiment_sessions 1、experiment_audio 1、actions 4、scroll_events 4、post_visibility 48。21秒合成MP4/AAC测试音频共676096字节，上传和SHA-256回读一致，公开访问被拒绝；不是实际被试声音。
- 本轮新增两条test_验收记录，需从正式样本中排除；没有删除、清空或修改既有被试记录，没有执行数据库迁移。
- 发布前数据库测试另8组通过，检查迁移保留、事务、幂等、权限及音频验证。线上浏览器证据在 `/private/tmp/labweb-inline-live-20261122/`，API结果在 `/private/tmp/labweb-inline-live-api-result.json`。后续文档补记使用 `[skip netlify]`，不重复部署已验证的应用。

## 48条测试链接

- 育儿补贴1：https://myexperiment.cn/?uid=test_20261122_fertility_48_01&n=48&topic=fertility
- 育儿补贴2：https://myexperiment.cn/?uid=test_20261122_fertility_48_02&n=48&topic=fertility
- AI就业1：https://myexperiment.cn/?uid=test_20261122_ai_48_01&n=48&topic=ai
- AI就业2：https://myexperiment.cn/?uid=test_20261122_ai_48_02&n=48&topic=ai

每次独立测试换新UID；相同UID会恢复之前的进度或返回已完成状态。跨设备独立试用也应分配不同UID。测试前缀是命名约定，应用仍执行完整正式流程。
