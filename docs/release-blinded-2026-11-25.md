# 2026-11-25 150秒阅读与四帖盲评发布

用户已执行release-blinded-20261124.sql。按既有流程核对正式库后，经GitHub main → Netlify自动部署到 https://myexperiment.cn。应用协议2026-11-24-v4，本地schemaVersion 5，旧版会话及数据继续保留。

本轮内容及本机验收见 [实现记录](blinded-protocol-2026-11-24.md)：8/24/48分组、结果判断核心题、移除新版理由库、四条任务规则、100秒隐形解锁／150秒硬结束、无限转发与取消、核心及把握先于再认和复看、固定四帖双评分盲评。

本机40组单元、11组数据库及10组HTTP检查通过，桌面24条与手机8条完整流程和150秒边界已验证；测试时钟和已保存状态检查与真实从入口流程分别记录。正式域名与正式数据库验收已通过，记录如下；本机与线上证据分别报告。

## 数据库

部署前仅以limit=0和API元数据检查新字段及三个v6 RPC，不执行远程迁移。正式保存测试使用独立test_ UID，不读取、改写或删除其他被试记录；分析时排除所有test_和历史qa_测试记录。

## QA链接（全部48条）

- 育儿补贴1：https://myexperiment.cn/?uid=test_blinded_20261125_fertility_48_01&n=48&topic=fertility
- 育儿补贴2：https://myexperiment.cn/?uid=test_blinded_20261125_fertility_48_02&n=48&topic=fertility
- AI就业1：https://myexperiment.cn/?uid=test_blinded_20261125_ai_48_01&n=48&topic=ai
- AI就业2：https://myexperiment.cn/?uid=test_blinded_20261125_ai_48_02&n=48&topic=ai

每台设备、每轮独立测试换新UID。同一浏览器相同UID恢复进度；旧UID继续其原协议。

## 发布确认

- 应用提交：`e15625c6afb49c7aba915b22672ed7afb91ef5e2`，已推送GitHub main。
- Netlify自动部署：`6b05bb94a67d7d1bba3ff0d9`，ready且为当前发布版本；北京时间2026-11-25 00:31:01发布。秘密扫描261个文件，无匹配。
- 正式域名：https://myexperiment.cn；新会话协议2026-11-24-v4。

## 正式站保存验收

1. Chromium桌面1440×900，48条育儿补贴，从真实入口完成五题前测、四条规则及理解题。实际等待阅读时间（未改时钟），99秒无完成按钮，100秒后有效转发3条显示按钮；四次转发取消一次，按钮与最终计数均正确。后测核心及把握在再认之前，四条盲评各两项必答，第二页刷新保持顺序和选择，文字解释及博物馆后完成。回读该UID确认completed_at、4条完整盲评、final_share_count=3、met_share_goal=true及unlock_shown_at_ms均已保存。
   - UID：`test_blind_live_browser_20261125_1440_1795537989799`
   - 证据：`/private/tmp/labweb-blinded-live-20261125/`，含结果JSON和页面截图；此项使用文字解释，麦克风为测试中拒绝授权。
2. 正式API及私有Storage，48条AI就业：前测提前保存不误报完成，错误会话secret拒绝，未上传音频阻止最终完成；676096字节audio/mp4测试音成功上传、SHA256下载回读一致、公开路径不可读取。解释提前保存不误报完成，最终全部字段回读一致，重复提交结果一致且无重复行。此为合成测试音，不代表实体麦克风验收。
   - UID：`test_api_blinded_release_20261125_1795538067400`
   - 行数：experiments 1、experiment_sessions 1、experiment_audio 1、actions 4、scroll_events 4、post_visibility 48。
   - 证据：`/private/tmp/labweb-blinded-live-api-result.json`；北京时间2026-11-25 00:35:18验收通过。
3. 首次API验收的合成动作遗漏interaction元数据，本地校验拒绝；补齐验收脚本后另用新UID重跑通过，未改应用。首次UID `test_api_blinded_release_20261125_1795537975710`只用于测试，应与其他test_记录一同排除，不删除已有记录。

此次上线无需再补SQL。实体iOS／Android及Credamo内嵌联调仍需相应设备／问卷验证；本轮线上完整浏览器验收为桌面Chromium。
