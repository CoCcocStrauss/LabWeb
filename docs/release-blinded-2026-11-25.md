# 2026-11-25 150秒阅读与四帖盲评发布

用户已执行release-blinded-20261124.sql。按既有流程核对正式库后，经GitHub main → Netlify自动部署到 https://myexperiment.cn。应用协议2026-11-24-v4，本地schemaVersion 5，旧版会话及数据继续保留。

本轮内容及本机验收见 [实现记录](blinded-protocol-2026-11-24.md)：8/24/48分组、结果判断核心题、移除新版理由库、四条任务规则、100秒隐形解锁／150秒硬结束、无限转发与取消、核心及把握先于再认和复看、固定四帖双评分盲评。

本机40组单元、11组数据库及10组HTTP检查通过，桌面24条与手机8条完整流程和150秒边界已验证；测试时钟和已保存状态检查与真实从入口流程分别记录。正式域名与正式数据库验收完成后补记，不把本机结果当线上验收。

## 数据库

部署前仅以limit=0和API元数据检查新字段及三个v6 RPC，不执行远程迁移。正式保存测试使用独立test_ UID，不读取、改写或删除其他被试记录；分析时排除所有test_和历史qa_测试记录。

## QA链接（全部48条）

- 育儿补贴1：https://myexperiment.cn/?uid=test_blinded_20261125_fertility_48_01&n=48&topic=fertility
- 育儿补贴2：https://myexperiment.cn/?uid=test_blinded_20261125_fertility_48_02&n=48&topic=fertility
- AI就业1：https://myexperiment.cn/?uid=test_blinded_20261125_ai_48_01&n=48&topic=ai
- AI就业2：https://myexperiment.cn/?uid=test_blinded_20261125_ai_48_02&n=48&topic=ai

每台设备、每轮独立测试换新UID。同一浏览器相同UID恢复进度；旧UID继续其原协议。

## 发布确认

待部署及正式保存检查完成后补充代码提交、部署ID和验收记录。
