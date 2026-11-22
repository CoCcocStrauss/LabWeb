# 2026-11-23 共用理由库与互动比较正式发布

用户已执行 release-reasons-20261123.sql，并授权发布当前完整版本及提供正式站QA链接。部署路径为 GitHub CoCcocStrauss/LabWeb main → Netlify opinionpolarization → https://myexperiment.cn。

## 发布范围

问卷版本2026-11-23-reasons-v1。前后相同核心题，保留原有补充判断与把握、博物馆题；新增前后同序的36条实质理由及两个补充项、多选不限三项、从全体36条理由选最认可和最不认可。再认完成后，以真实仍点赞与实际转发的并集呈现全部互动帖子，比较支持最强／最弱，处理零／单候选、支持相近与无支持状态，独立保存复看过程。

新模块、音频、解释和最终状态统一校验及原子保存；保留旧v1／v2／v3会话与校验，不中途转换旧题。正式阅读的布局、计时、标签和行为定义沿用已发布版。Credamo真实嵌入联调仍待平台HTML题可用。

本机实现与技术验收见 [完整实现记录](reasons-protocol-2026-11-23.md)：35组单元、10组数据库、8组HTTP、材料检查、生产构建及桌面48条／手机8条完整流程已通过。正式域名的完整验收结果见下方发布确认。

## 数据库

用户负责执行增量SQL。本轮部署前只读核对新增pre_reasons、post_reasons、interaction_comparison字段与save_experiment_pretest_v5、save_experiment_explanation_v5、submit_experiment_v5三个RPC；不重新执行迁移、不读取或修改已有被试记录。实际保存测试使用独立test_ UID，需从正式样本中排除。

## 48条QA链接

- 育儿补贴1：https://myexperiment.cn/?uid=test_reasons_20261123_fertility_48_01&n=48&topic=fertility
- 育儿补贴2：https://myexperiment.cn/?uid=test_reasons_20261123_fertility_48_02&n=48&topic=fertility
- AI就业1：https://myexperiment.cn/?uid=test_reasons_20261123_ai_48_01&n=48&topic=ai
- AI就业2：https://myexperiment.cn/?uid=test_reasons_20261123_ai_48_02&n=48&topic=ai

手机、电脑均可访问。独立试用使用不同UID，相同UID恢复原进度；既有旧版UID仍按其原版本继续。test_仅为筛除约定，测试仍写正式数据库；历史qa_记录同样须排除。

## 发布确认

- 应用代码提交：`16c64b40aa16d399c6be845853bdc143c0b4c95f`，已推送GitHub main。
- Netlify生产部署：`6b0343d792d58db9dfbfbca8`，状态ready，2026-11-23北京时间03:35发布到 https://myexperiment.cn；对应上述应用提交，密钥扫描无命中。
- 迁移就绪核对：三个新字段以limit=0读取通过，三个v5 RPC在正式API元数据中存在；没有重跑远程SQL。
- 正式站Chromium完整48条育儿补贴流程通过，验收UID：`test_browser_reasons_release_20261123_1795376644031`。前测理由多选5项、全库最佳／最差、前后同序而答案独立、理由页刷新、再认先于复看、真实点赞取消与转发并集去重、比较页刷新、统一解释、后测理由无法比较、博物馆与最终完成均通过。
- 浏览器流程正式库回读：前后各38条候选快照一致，互动比较3条、复看区间15段；actions 5、post_visibility 48、experiment_audio 0。前后理由、完整比较及阅读指标与客户端最终载荷一致，completed_at已写入。测试使用文字解释，没有采集真实麦克风。
- 正式站API／私有存储验收通过，UID：`test_api_reasons_release_20261123_1795376747262`。48条AI材料、完整前测理由、解释提前保存、两套理由、互动比较、标签和阅读数据全部回读一致；重复提交返回相同完成码，没有重复入库。
- API录音为21秒合成MP4/AAC，共676096字节，上传、私有下载SHA-256校验及公开访问拒绝通过；不是被试真实声音。关联行数experiments 1、experiment_sessions 1、experiment_audio 1、actions 4、scroll_events 4、post_visibility 48。
- 初次线上验收遇到网络超时，重试后通过；重试产生的未完成test_记录也需排除。所有验收UID使用test_前缀，没有清空或修改既有被试数据。
- 证据：`/private/tmp/labweb-reasons-live-20261123/desktop-flow.json`、同目录截图、`/private/tmp/labweb-reasons-live-api-result.json`。文档补记使用[skip netlify]，不重复部署已验收的应用。
