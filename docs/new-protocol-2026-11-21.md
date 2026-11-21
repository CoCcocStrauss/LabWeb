# 2026-11-21 新后测与录音本地实现

本记录对应 `LabWeb_修改交接.md` 的新方案，以及用户随后确认的首版再认题细则。旧版实现与早期验证结论保留在 `local-update-2026-11-21.md`，不改写历史。本轮保留原暂存区和工作区修改，没有推送、部署或执行远程数据库迁移。

## 流程与版本

新问卷版本为 `2026-11-21-v2`，浏览器进度键为 `labweb:session:v2:<UID>`。

前测五题（三个原立场题、把握、独立博物馆题）→提前保存→教程→理解题→开始页→90秒阅读→即时再认→具体立场→判断把握→自由解释→原因选择及主要原因→独立博物馆题→原子保存成功→返回问卷。保留原六组、审核材料和原人设。手动结束仍需转发满两条，零条/一条可正常超时。

再认使用一道内容题：从实际转发中等概率抽一条，配三条本次展示但未转发帖的前48个Unicode字符，再加“记不清了”。两条已转发帖不会同时出现在选项中；无转发跳过并记录 `no_shares`。候选、片段、人设、顺序、目标、选择、正确性和时间分别保存，不反馈对错，不以答对为继续条件，不加入“以上都没有”。生成后持久化，刷新不重抽。

后测不重复原三个宽泛立场题，直接记录新具体陈述及把握。自由解释先于原因列表；文字有效计数只算Unicode字母/数字，20个有效字符或20秒录音满足任一即可，不合并折算。双方都填写时一并保留；不足20秒但文字达标的录音也会上传保留。原因10项随机顺序持久化，“其他”与“整体感觉”固定末尾；最多三项、感觉互斥、多项再选主要项、单项自动记主要项。“其他”可选填，不要求20字。博物馆题两次原文一致，单独显示，无议题情境。

旧版 `2026-11-21-v1` 会话保留独立题目、流程、校验和原RPC。检测到旧浏览器键时继续旧会话，不静默把原五题后测映射成新后测。

## 录音实现

产品组件默认直接调用 `getUserMedia({audio:true})`，显式点击后请求权限。使用原生MediaRecorder，按浏览器支持选择WebM/Opus、MP4/AAC或Ogg；计时从实际start事件开始，权限等待不算时长。允许停止、试听、删除、重录，默认不自动播放；切到后台会停止录制。刷新时未正常结束的录音标记中断，不能拿中断元数据当作合格录音。

音频以ArrayBuffer和MIME存进IndexedDB，读取时恢复Blob，并兼容已存在的Blob草稿。localStorage只存元数据，完成录音后计算SHA-256。上传失败保留本机内容，可以重试、取消上传，或文字达标后明确选择仅提交文字。20MB为技术上限。时长门槛不等同于有效表达，不进行自动转录、静音剔除或研究质量判定。

服务端验证会话秘密的哈希与UID/会话绑定；文件路径为会话UUID/录音UUID，存储桶必须私有。签名仅用于上传，禁止覆盖。确认接口核对私有桶、文件尺寸、MIME、容器签名和SHA-256后才记为verified；最终事务检查录音归属、元数据和verified状态，必需音频未确认不能记为实验完成。容器签名和摘要验证不等同于完整音频解码或服务端识别有效讲话时长。

参考：[MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)、[MediaRecorder格式支持检测](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)、[Supabase私有存储](https://supabase.com/docs/guides/storage/buckets/fundamentals)。

## 数据库准备

新环境可执行 `supabase/schema.sql`（应用表与RPC），再执行存储迁移。已有环境按顺序审阅并执行：

1. `supabase/migrations/20261121_questionnaires.sql`
2. `supabase/migrations/20261121_posttasks_audio.sql`
3. `supabase/migrations/20261121_audio_storage.sql`（Supabase Storage专用）

所有迁移仅准备在本地。音频桶新增限制性policy，即使已有宽泛的对象读取policy，anon/authenticated也不能读取本桶。没有创建公开回放链接。正式采用前还需确认外部知情同意中的录音用途、访问范围和保留期限，并在真实Credamo iframe与实体手机试测；独立macOS Safari成功不能替代iOS、Android、Windows和真实嵌入验收。跨域嵌入需检查HTTPS、iframe `allow="microphone"` 和父页面Permissions-Policy。

## 验证

- 逻辑与接口mock测试11组：题序/无预选、六条件、零/一/两次转发、非法字段与时间拒绝、刷新恢复、稳定摘要、失败重试、新旧版本兼容、Unicode计数、独立门槛及原因约束。
- 内存PostgreSQL（PGlite）6组：原子回滚、幂等、旧数据与旧RPC、音频未验证不能完成、会话秘密、匿名权限、私有桶限制性policy。没有向真实研究数据库写测试记录。
- 本地实际HTTP接口3组：六条件完整提交、数据库已提交但响应丢失后的重试、音频上传失败与重试/不可覆盖/匿名读取拒绝/验证前阻止完成。
- `npm run materials:check`：两议题各48条与审核表一致，8/16/48抽样和人设对应通过。
- Safari实际MediaRecorder生成MP4/AAC：合成音源约45秒；随后切换真实麦克风，用户录制约5秒并明确确认能听到自己的声音。此前滴声来自测试音源，不能作为真实收音失败证据。短录音显示不足20秒；刷新后元数据与本机音频可恢复。

临时浏览器验收页已移除，测试录音没有写入仓库或远程存储。最终 `npm run build` 通过编译、类型检查和Lint，无临时测试路由；`git diff --check` 通过。真实麦克风约5秒录音刷新后恢复，补充30字测试文字后，浏览器显示输入方式为both、音频uploaded；本机隔离数据库确认该42327字节MP4/AAC文件verified。原因多选和主要原因均在浏览器完成。

最终一次从再认开始连走至完成页的浏览器检查未取得完整通过结果：临时夹具复用了已有会话ID，被数据库唯一约束拒绝，且Safari自动化间歇无法读取页面AX树。该临时入口已移除，不能把20组逻辑/数据库/HTTP测试通过写成真实浏览器全流程通过；真正Credamo嵌入和实体手机仍待下一轮。

数据库测试使用临时安装的 `@electric-sql/pglite@0.3.14`，通过 `PGLITE_MODULE=<模块绝对路径>` 指定；没有新增运行时依赖。复现顺序为 `npm test`、配置PGlite后 `npm run test:database`，再启动 `npm run qa:database` 与 `npm run qa:app` 后 `npm run test:api`。QA服务显式覆盖数据库地址和key，不向真实研究数据库写入。
