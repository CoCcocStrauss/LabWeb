# 2026-11-24 结果判断、150秒阅读与四帖盲评

按 labweb_2026_11_24.md 实现，页面变化采用 2026_11_24 文案参考.md（两文件措辞不同时以文案参考为准）。以下为本机实现与隔离验收记录；用户于11月25日确认SQL已执行，正式发布进度与外网QA见 [发布记录](release-blinded-2026-11-25.md)。

## 实现

新协议2026-11-24-v4，本地schemaVersion 5。新入口8／24／48，24严格三组8条正交区组；既有v1／v2／v3／2026-11-23-reasons-v1会话仍原路恢复，16仅供历史路径，不转成24。原理由库、全库比较与互动强弱比较代码和字段保留，新协议不呈现、不填写。

前测为相同结果判断核心题、原两道补充判断、把握及无标题三档博物馆；新选项完全不会／应该不会／说不准／应该会／一定会。任务说明新增参考文案中的引导和红包激励，四条短规则，理解题保留3秒／5秒前台反馈。示例中转发可以切换取消，不写正式数据。

正式阅读150秒，100秒前即使达标也没有结束按钮，仅显示文案参考中的中性提示；100秒后有效转发至少2条才出现完成浏览。首次按钮显示时间写入unlockShownAtMs，刷新不重置起点；150秒自动结束，未达标也可继续。新协议不记录或显示30秒红框，也移除倒计时红色／闪烁。有效转发无上限，取消立即产生unshare记录，计数、达标和后测取最终集合。原瀑布流、跨列展开、单标签、原始语料及正式曝光机制沿用。

阅读结束先记录核心判断和把握，再生成转发再认，之后进入四帖盲评、原统一文字／录音解释及博物馆。盲评一页一帖全文，保留当时作者和实际标签，不显示点赞转发角标、不开放操作；每帖两道必答五档评分，下一页不预选，顺序及已有答案刷新保留。

## 抽样与边界

以最终A转发池、B仅点赞池、C已看未互动池抽样。B按正式可见时长降序，C优先展开过全文再按时长；同值按原始阅读序保持稳定。保存一次随机seed，服务端可确定性重建随机转发子集和最终四帖顺序，验证候选正文、作者、实际标签、角色与评分。

正常配额遵循交接文档。若指定对照池不足但A+B+C仍有足够材料，依次用尚未入选的B、C、A补足；只有三池总数不足4时才从未看材料随机补充并标记fallback_unseen。这个补位细则覆盖文档没有明确列出的池间不足情形，仍完整记录各帖真实来源，不把额外转发帖伪称为对照帖。

放开转发上限后，可能出现所有或几乎所有材料都已转发，导致不足3条合法未转发干扰项。此时再认记录not_applicable及skipReason=insufficient_distractors并跳过；无转发仍为not_applicable/no_shares。两者区分保存，不制造重复干扰项或掺入其他已转发内容。

盲评保存四帖快照、sampleRole、正式totalVisibleMs／wasExpanded、展示顺序、每页两项评分、呈现和作答时间、前台累计visibleMs；后测停留不写入正式reading_metrics。隐藏／刷新间隙不累计。原始研究质量和立场编码不显示在盲评页。

## 数据库

增量SQL：supabase/release-blinded-20261124.sql，在已有2026-11-23迁移之后运行。只放宽条件约束到8/16/24/48、允许unshare、增加experiments.met_share_goal/final_share_count/unlock_shown_at_ms和experiment_sessions.blinded_post_evaluations；新增三个v6 RPC，沿用私有录音校验及原子事务。旧RPC与理由字段不删除不改写，旧16条完成记录保留。

11月24日本机实现时未迁移正式库，以上本机测试只写隔离内存库。用户于11月25日确认增量SQL已执行；随后新应用已上线，正式保存验收见发布记录。

## 验证

- 40组单元全量回归通过，包含原35组和新增5组盲评测试。覆盖六条件、同核心题、24区组、0/1/2/4/全部转发、四帖唯一性、候选及评分篡改拒绝、时长边界和四条规则。
- 原数据库10组回归通过；另新增迁移复跑保留既有16条数据、新24条盲评与完成字段、幂等提交检查通过（总计11组）。
- 实际本机HTTP10组通过，含新六条件、四帖结果和完成字段回读；另验证新版24条会话的补充短录音、文字与盲评共同保存；旧版与音频接口原测试继续通过。
- 生产构建通过编译、类型、Lint。没有新运行时依赖或测试路由。
- Chromium桌面1440px、24条育儿补贴和手机390px、8条AI完整流程通过。从入口、五题前测、四条规则、理解反馈、阅读四次转发取消一条、99秒无按钮／100秒有按钮、后测核心两题在再认之前、四页双评分、刷新不重抽、解释及博物馆到最终数据库回读均通过。100秒边界使用仅在测试上下文内的可控时钟，不修改产品计时器。
- 另以隔离的已保存状态验证150秒自动结束、0/1/2/4转发及4转发+5点赞路径，结束时间精确150000ms，后测盲评四条无互动标记。这与完整从入口流程分开报告。
- 截图人工检查无重叠／横向溢出。证据保留 /private/tmp/labweb-blinded-20261124/。未取得实体iOS／Android、Credamo内嵌及线上新版保存验收；不把本机模拟存储的音频测试作为实体麦克风验证。

本机QA：
- http://127.0.0.1:3210/?uid=test_blind_fertility_20261124_01&n=24&topic=fertility
- http://127.0.0.1:3210/?uid=test_blind_ai_20261124_01&n=48&topic=ai

新UID从头测试；旧UID按其已有版本恢复。以上只在当前电脑QA服务运行期间可用，内存库重启会清空测试记录。

## 11月25日页面微调（本地待发布）

- 新版教程只呈现一张可展开、点赞及转发／取消的示例卡，保留同一套单标签抽样和刷新恢复；旧协议教程保持原实现。
- 规则题反馈显示“回答正确／回答错误，N秒后进入正式作答”，按原先正确3秒、错误5秒的前台累计时间倒计时，后续开始实验流程不变。
- 达标但尚未解锁时，底部仅显示“已转发 N 条，请继续浏览”。100秒解锁及150秒自动结束规则不变。
- 40组回归和生产构建通过。Chromium 1440×900、手机模拟390×844验证单示例及标签刷新、展开／收起、点赞和转发取消、正确3秒与错误5秒倒计时、3条转发简短提示及无横向溢出。截图保留 `/private/tmp/labweb-copy-20261125/`。
- 本次不涉及数据库字段或SQL迁移，尚未推送／部署。

## 11月25日展开可见时长修复（本地待发布）

用户在test_blinded_20261125_fertility_48_01发现open后预览停止但detailIntervals为空。已在本机48条完整入口复现：新版观察器把CSS选择器误写成“../../../components/.feed-fulltext”（另一处closest同样错误），浏览器抛出无效选择器异常，全文观察器从未正常绑定。原始复现证据保留 `/private/tmp/labweb-detail-before-20261125.json`。

修复限定新版v5目录，保留前一轮尚未发布的三项页面修改：

- 正确绑定全文正文`.feed-fulltext`。正文与阅读滚动区有正面积交集且页面可见才累计；观察器配合滚动、布局、切屏恢复及定时检查同步实际几何位置。
- 展开先结束该帖短卡曝光；全文滚出／切屏／pagehide暂停，滚回／重新可见／pageshow续记为新段，收起、手动或超时结束关闭活动段。多张展开卡独立记录。忽略过期观察器回调，tracker也拒绝为已展开帖重启短卡曝光、为已收起帖重启全文计时。
- 新段写入`postId/startMs/endMs/durationMs`，startMs和endMs为Unix毫秒时间戳，durationMs=endMs-startMs；同时保留既有startedAt/endedAt等值字段。`detailVisibilityVersion=inline-visible-segments-v1`标识修复后的追踪器。恢复旧草稿时保留已有区间并补齐别名，刷新离开间隙不累计，快照不重复加入活动时段，不写零时长段。
- 服务端验证字段一致、正时长、位于展开/收起范围、同帖区间不重叠，并拒绝与同帖短卡曝光重叠的新版本区间；已有无版本标记的历史数据继续兼容。
- `post_visibility`只存短卡曝光；分析单帖总可见时长时，将其total_visible_ms与该帖detailIntervals的durationMs之和合并。不要把全文时长再次塞进post_visibility。

验收：42组单元、12组隔离PostgreSQL、11组实际HTTP通过；生产构建的编译、类型及Lint通过。数据库直接回读：短卡1000ms，全文三个区间合计2500ms，重试不累加，JSON原样保存。

Chromium桌面1440×900、手机模拟390×844，各48条育儿补贴从入口到最终完成并回读数据库。验证展开即产生非空区间、多卡独立（桌面）、滚出／滚回、收起再展开、实际刷新、页面可见性事件模拟、手动结束（桌面）及150秒超时（手机）。结束区间均截断于结束时间，逐段与短卡事件比对无重叠，无pageerror。结束时间边界使用仅在测试上下文中的时钟偏移，切屏由document.visibilityState与事件模拟；不冒充实体设备或操作系统切屏验收。

浏览器结果证据：`/private/tmp/labweb-detail-20261125/result-1440.json`、`result-390.json`。可复跑脚本：`scripts/test-detail-visibility-browser.cjs`；先启动本机qa:database和qa:app，再运行`PLAYWRIGHT_MODULE=/private/tmp/labweb-browser-20261121/node_modules/playwright npm run test:browser:detail`（或提供已安装Playwright模块路径）。脚本只访问localhost，结果写入系统临时目录labweb-detail-visibility-qa；勿与会注入下一次失败的HTTP回归同时运行。

无需SQL迁移，继续保存到现有reading_metrics JSONB。未改写用户指出的旧记录；丢失的实际全文可见时长不能从open/close可靠推算。当前修复及前一轮页面修改均未推送／部署，正式QA链接须待发布后才生效。

## 11月25日三步教程与切屏提醒（本地待发布）

依据`labweb交接_2026_11_25.md`继续增量实现。按用户最新指示暂不上线，保留此前本地单示例、理解题倒计时、简短转发提示及detailIntervals修复；不执行交接末尾推送步骤。

规则教程改为如何阅读／如何转发与改选／时间、专注与激励三步，进度1/3、2/3、3/3，无复选框。逐字采用参考正文。前两步各一张中性示例，React四阶段状态按625ms推进（完整循环约2.5秒），CSS轻点光圈配合展开／收起或转发／取消；点击正文、点赞或转发即暂停该步自动演示，交由手动操作。尊重prefers-reduced-motion，此偏好下保持静态并可手动体验。示例不创建正式reading/actions数据。第三步包含原文防切屏浅色提示块及静态状态栏高亮预览，无100秒解锁说明。前测保存仍在第一步后台触发，失败保留内容并显示重试，成功后才可下一步。

数据沿用rules JSONB的startedAt/completedAt/items、demoLabelSelectionVersion/demoLabelSelections：新增presentationVersion=three-step-demo-v1、activeStep；items依次为step_1/step_2/step_3，各存enteredAt、completedAt、demoPostId。保留checked/changedAt字段，含义为“已通过下一步完成该步骤”及首次完成时间，并非新增勾选操作。后退不重置首次时间或重抽标签，刷新恢复当前步。服务端同时接受原四规则已完成记录及新的三步记录；只有仍在pretest_save/tutorial的旧草稿升级教程，ready及之后不重写原规则。

正式阅读hidden→visible后在顶栏下方显示原文轻提示，3秒自动消失；不监听blur，不强制全屏，不改150秒deadline，不阻断操作。原interruptions继续保存阶段及hidden/visible时间。新增reading_metrics.attentionVersion=reading-visibility-v1、hiddenCount、totalHiddenMs、hiddenAtMs（暂存尚未结束的隐藏段）。重复hidden不重复计数；返回时立即保存汇总，实验结束按deadline截断；恢复隐藏中的草稿使用savedAt衔接累计，避免快照重复加时。此前已保存的历史记录保持原样，不伪造缺失埋点。

数据库无新增表列或RPC，仍用现有JSONB和v6接口。上一轮release-blinded-20261124.sql已执行，无需再迁移；提供`supabase/check-tutorial-attention-20261125.sql`只读核验现有字段、接口和指定test_ UID的新数据（使用前更换UID）。该SQL已在隔离PostgreSQL执行验证，不更新或删除记录。

本轮验证：

- 46组单元全部通过：新三步及原四规则兼容、步骤时序及篡改拒绝、标签持久、切屏次数去重、快照/恢复累计隐藏时长、24条取消转发不进入再认目标或盲评转发池；此前全文追踪回归保留。
- 13组数据库、11组实际HTTP通过，三步规则、切屏汇总、全文区间原样入库，旧协议及幂等仍正常；只读核验SQL不改写已有数据。
- 最终生产构建编译、类型、Lint通过，无新增依赖。
- Chromium完整入口→完成→隔离库回读：1440×900桌面24条手动结束；390×844手机模拟48条150秒超时结束。验证动画和手动接管、三步前后与刷新、3秒提醒、三个转发再取消第一个、unshare最终保存、取消帖不作为再认目标／盲评shared角色，全文滚出/回、刷新、收起、结束收尾及短卡不重叠。两组actions各4条、post_visibility分别24/48。结束边界使用测试上下文时钟偏移，切屏由visibility事件模拟；源码脚本`scripts/test-detail-visibility-browser.cjs`可复跑。
- 独立原生Chromium通过实际Target标签切换（不覆盖document.visibilityState）离开3秒再返回：beforeClock=02:28、afterClock=02:25，hiddenCount=1、totalHiddenMs=3252，原文提示正常显示并自动消失；blur不触发提示，隐藏暂停全文时长、返回恢复。此项从已准备的阅读状态验证，不冒充完整入口流程。证据`/private/tmp/labweb-native-visibility-result.json`及`labweb-native-return-notice.png`。
- 320×640手机尺寸与减少动态效果偏好：静态示例可手动体验，前测保存失败／重试、标签不重抽、示例不产生正式行为、旧未完成教程草稿升级通过。截图`/private/tmp/labweb-tutorial-attention-20261125/step3-320.png`。

完整浏览器证据位于系统临时目录`labweb-detail-visibility-qa`（含三步截图及result-1440.json/result-390.json）。本轮仅访问本机隔离数据库，未修改正式数据、执行远程SQL、提交／推送Git或部署。

## 11月25日网络加载兜底（本地待发布）

用户报告某些网络下加载进度接近完成后白屏，授权先修改前端兜底，未授权切换正式托管或上线。连接诊断与本次代码修复区分：测试网络上正式根域名IPv4及Netlify入口IPv4直连超时，默认域名IPv6及代理访问可返回200；国内IPv4对照可连接。这只是该测试网络的实测，不代表所有失败设备都同因。正式DNS、Netlify主域名和服务器配置未变。

新增共享PageLoading，接入主入口、v5/v4及v2/v1旧会话的动态页面加载和原错误边界。加载中持续显示标题；12秒后由CSS显示网络提示和手动重载入口，明确加载失败时立即显示。重载为原生同页链接，保留当前查询参数，JavaScript尚未运行时也能使用；提供noscript启用提示。不自动刷新、不清空存储、不改实验起点或deadline；没有新增外部脚本、监控服务或运行时依赖。此兜底依赖入口HTML可取得，不能代替无法建立连接时的托管线路修复。

验证：46组回归与生产构建编译／类型／Lint通过。新增`scripts/test-network-loading-browser.cjs`三组真实Chromium故障注入：

1. 桌面1440×900挂起v5主分包：标题始终可见，实际12秒后出现重试，期间只有一次文档请求，无自动刷新；放行资源后正常进入。
2. 手机390×844拒绝阅读分包：立即显示错误与重载链接，放行后手动重试，URL、UID、sessionId、帖子顺序、已保存操作及原150秒deadline均不变（基于已保存的阅读草稿）。
3. 320×640禁用JavaScript：服务端提示、noscript文字、CSS延迟重试及原生重载仍可用，重载保留URL。

测试只访问localhost，不写正式数据库。证据位于系统临时目录`labweb-network-loading-qa`，包含result.json及三种界面的截图。可在启动qa:app后执行`PLAYWRIGHT_MODULE=/private/tmp/labweb-browser-20261121/node_modules/playwright npm run test:browser:loading`。无需SQL迁移，未提交／推送或部署。
