# 香港 ECS 精品线路测试部署

当前只准备独立测试环境。正式域名、Netlify、现有数据库不切换。本目录不会自动购买云资源、修改安全组或上传密钥。

## 待确认配置

- 中国香港，Linux x64，Ubuntu 24.04，2 vCPU / 4 GiB，40 GiB 系统盘；先按量测试。
- ECS 不分配普通公网 IPv4；另购同地域 **BGP（多线）_精品 EIP**，绑定 ECS。
- 使用独立 QA 子域名（拟 `hkqa.myexperiment.cn`）；只在实测通过后讨论正式切换。
- 公网只开放网站所需 TCP 80 / 443；管理用 SSH 22 限制管理员来源 IP，不开放 RDP 或 Node 3000。
- 数据库仍使用现有 Supabase。新版材料发布前须先执行 `supabase/release-materials-20261125.sql` 并核对3个v7保存函数；迁移部署线路本身不另建数据库。录音仍直传 Supabase，必须单独实测网络。
- 精品线路效果以校园网、移动网络、VPN 等真实用户网络实测为准，不能仅凭线路名称保证。

费用记录见 `quote-2026-11-25.md`（配置页报价核实后填写）。ECS 停机不代表磁盘和 EIP 都停止收费；测试结束需检查并释放不再使用的测试资源。不要把自动释放 ECS 当成释放 EIP。

## 打包与构建

本机执行 `node scripts/package-ecs.cjs`，输出临时目录的源码 `.tar.gz` 和 SHA-256。包只含应用源码、构建配置、头像和本目录；不含 `.env.local`、Git、node_modules、原始表格和研究 prompt。`public` 中除 `avatars` 外的条目会明确列在排除清单中；将来新增网页资源须同步更新打包白名单。

不要从 macOS 上传 node_modules 或 standalone 运行包到 Linux。购买确认后，在 ECS 安装官方 Node.js 24（确保 `/usr/bin/node` 为 Node 24）和官方 Caddy。管理员创建不带登录 shell 的 `labweb` 服务用户、`/srv/labweb/{sources,releases}` 与 `/etc/labweb`；源码和 release 归 `labweb` 所有。

将源码包上传到 ECS 的 sources 目录，解压到新的版本目录，以 `labweb` 用户执行：

```bash
bash deployment/ecs/build-release.sh /srv/labweb/releases/唯一版本号
```

构建使用占位数据库参数，实际凭据只在运行时从服务器 `/etc/labweb/runtime.env` 读取：

```text
SUPABASE_URL=实际的 Supabase 项目地址
SUPABASE_SERVICE_ROLE_KEY=实际的服务器专用密钥
```

该文件由管理员安全填写，root 所有、权限 `0600`，不上传到 Git 或通过浏览器表单传递。systemd 会在降权到服务用户前读取 EnvironmentFile。不要拷贝本机代理变量，服务器需要直接连通 Supabase。

## 激活与回退

管理员安装 `labweb.service` 到 `/etc/systemd/system/`，记录旧 `current` 目标；将 `/srv/labweb/current` 原子更新为新 release，执行 daemon-reload 和 restart。先用 `curl -f 'http://127.0.0.1:3000/api/status?uid=test_ecs_deploy_probe'` 验证应用与数据库链路。此接口只读，不生成被试数据。

独立 QA 子域名解析、80 / 443 和运维访问权限经确认后，再使用示例 Caddyfile；先 `caddy validate`，再 reload。HTTPS 证书成功后用 HTTPS 访问并测试录音，不使用 HTTP 进行麦克风验收。若启动或验收失败，将 `current` 恢复旧目标并 restart。保留旧 release，避免无法回退。

## 验收后才能切换

1. 校园网 / 三家运营商手机流量 / VPN 开关的首开、刷新、静态资源、断网重试。
2. 新 `test_` UID 跑完整 48 条流程，含卡片展开、隐藏恢复、计时、点赞转发、前后测及完成状态。
3. 文字与真实录音分别提交，核对数据库记录和存储对象，回放可听见本人声音。
4. 正式域名迁移要保留同一 origin；测试子域名不承诺恢复正式站 localStorage。避免实验进行中切换版本。
5. 记录实测结果、费用和回退方法，再由用户决定正式切换。当前没有发布或 DNS 变更授权。

官方说明：[精品 EIP](https://help.aliyun.com/zh/eip/use-boutique-eip-to-optimize-access-to-international-business-in-mainland-china)、[EIP 按量计费](https://help.aliyun.com/zh/eip/pay-as-you-go/)、[Next.js 自部署](https://nextjs.org/docs/14/pages/building-your-application/deploying)。
