# 2026-11-23 共用理由库与互动比较正式发布

用户已执行 release-reasons-20261123.sql，并授权发布当前完整版本及提供正式站QA链接。部署路径为 GitHub CoCcocStrauss/LabWeb main → Netlify opinionpolarization → https://myexperiment.cn。

## 发布范围

问卷版本2026-11-23-reasons-v1。前后相同核心题，保留原有补充判断与把握、博物馆题；新增前后同序的36条实质理由及两个补充项、多选不限三项、从全体36条理由选最认可和最不认可。再认完成后，以真实仍点赞与实际转发的并集呈现全部互动帖子，比较支持最强／最弱，处理零／单候选、支持相近与无支持状态，独立保存复看过程。

新模块、音频、解释和最终状态统一校验及原子保存；保留旧v1／v2／v3会话与校验，不中途转换旧题。正式阅读的布局、计时、标签和行为定义沿用已发布版。Credamo真实嵌入联调仍待平台HTML题可用。

本机实现与技术验收见 [完整实现记录](reasons-protocol-2026-11-23.md)：35组单元、10组数据库、8组HTTP、材料检查、生产构建及桌面48条／手机8条完整流程已通过。正式域名的验收在部署后补记。

## 数据库

用户负责执行增量SQL。本轮部署前只读核对新增pre_reasons、post_reasons、interaction_comparison字段与save_experiment_pretest_v5、save_experiment_explanation_v5、submit_experiment_v5三个RPC；不重新执行迁移、不读取或修改已有被试记录。实际保存测试使用独立test_ UID，需从正式样本中排除。

## 48条QA链接

- 育儿补贴1：https://myexperiment.cn/?uid=test_reasons_20261123_fertility_48_01&n=48&topic=fertility
- 育儿补贴2：https://myexperiment.cn/?uid=test_reasons_20261123_fertility_48_02&n=48&topic=fertility
- AI就业1：https://myexperiment.cn/?uid=test_reasons_20261123_ai_48_01&n=48&topic=ai
- AI就业2：https://myexperiment.cn/?uid=test_reasons_20261123_ai_48_02&n=48&topic=ai

手机、电脑均可访问。独立试用使用不同UID，相同UID恢复原进度；既有旧版UID仍按其原版本继续。test_仅为筛除约定，测试仍写正式数据库；历史qa_记录同样须排除。

## 发布确认

GitHub提交、Netlify部署及真实域名保存结果将于完成后补记。
