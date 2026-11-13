# 第三方订阅：部署与维护

当前版本已经升级 PHP 8.4 / Laravel 12。全新宝塔安装请使用 docs/baota-install.md：安装器现在自动创建第三方表，无需另跑迁移。下面单独迁移步骤适用于尚未创建本功能表的旧站。

## 行为

一个来源可以绑定多个套餐，一个套餐可以绑定多个来源。用户获得本站原有节点和当前套餐绑定来源中的节点。第三方节点保留供应商凭据，不使用本站用户 UUID 替换。

第三方下发要求：plan_id 有值、未封禁、未到期（NULL 表示长期有效）、本站额度大于已用上传与下载之和。流量重置或加购后自动恢复。第三方实际流量不回传本站。到期只停止下发，不能撤销用户已下载的供应商凭据。

每 30 分钟同步；失败使用最近一次成功快照，成功时间超过 24 小时则停止下发该来源。停用、删除或解绑立即影响后续订阅请求。更换 URL 清除旧快照；更改来源名称、套餐绑定保留快照。账户被现有风控限制时不下发第三方节点。

## 首次部署

1. 备份数据库与 APP_KEY。保持现有服务器 Git origin 指向自己的 fork。部署前先在测试站验证，不要将生产凭据放到代码仓库。
2. 拉取包含本功能的提交，并按本站既有流程安装依赖。此功能没有新增 Composer 包，也没有改变依赖安全策略。
3. 在项目根目录只执行本功能迁移：

```bash
php artisan migrate --path=database/migrations/2026_11_13_000001_create_external_subscriptions.php --force
php artisan view:clear
php artisan route:clear
```

4. 确认 PHP CLI 与 Web 都有 cURL、OpenSSL、mbstring、PDO，以及项目原有扩展；CLI 版本应与部署环境一致（本次使用 PHP 8.4 测试）。保持原有 Redis/缓存可用。
5. 确认原有 Laravel 调度任务每分钟运行 `php artisan schedule:run`。本功能已注册每 30 分钟同步，不需要另起一个重复的定时任务。
6. 现有站执行 update.sh 会自动安装锁定依赖、迁移并清理视图和路由缓存。如果使用 Webman、常驻 PHP 或缓存路由，按现有部署方式重启/刷新。
7. 登录原后台，在「服务器 → 第三方订阅」管理来源；地址为 `https://你的域名/你的后台路径#/external-subscriptions`。原独立页地址自动跳转到此处。
8. 新增来源，填写最终订阅 URL，多选套餐并保存；点击“同步”，检查节点数与诊断。选择一个有效测试用户分别导入常用客户端验证真实连接。

管理员接口沿用本站 admin 中间件。页面复用原后台登录令牌与布局，不需要第二次登录。在「财务 → 订阅管理 → 编辑订阅」也可以多选第三方来源；两边编辑的是同一组绑定。旧表单检测到绑定变更时会拒绝覆盖，请关闭并重新打开编辑。API 不回显来源 URL；编辑 URL 留空表示保留。新增来源与快照使用 APP_KEY 加密保存，因此必须备份并保持 APP_KEY，不能直接换 key 后期望旧快照仍可读取。

## 支持范围和明确限制

- 输入：UTF-8 的 URI 列表或标准/URL-safe Base64 编码列表；不是 Clash YAML 或完整 Sing-box JSON 配置。
- 协议：SS（AEAD 与 2022）、VMess AEAD（alterId=0）、VLESS、Trojan、Hysteria 2、TUIC、AnyTLS。
- 通用传输覆盖 TCP、WS、gRPC；VLESS 覆盖常规 TLS/Reality 与 xtls-rprx-vision。TUIC UUID/密码分离；Hysteria 2 支持 salamander。
- 未实现的参数会报错跳过，不悄悄丢弃后输出：例如 SS plugin、端口跳跃、证书固定、ECH、XHTTP、VMess 非 auto 加密及非 AEAD。它们可以作为后续增量兼容任务。
- 现有客户端输出均有接入；不意味着客户端本身支持所有协议。Clash 旧版、旧 Sing-box、Surge、Loon、Quantumult X 等按已有生成器能力过滤；行式配置对特殊分隔符、非 TCP 传输、Reality、显式 ALPN 采取保守跳过。同步状态显示各客户端跳过数量。URI 客户端保留原分享参数，实际支持取决于客户端内核版本。
- 管理页每来源显示同步诊断；最多保留前 50 条解析错误，不展示包含密码的原始行。完全没有可用节点时视为同步失败，保留仍在期限内的旧快照。
- 单来源最多 2 MiB、1000 节点；最多 100 来源；单次用户输出最多 3000 个第三方节点，按来源 ID 排序截取。不要配置超出此规模的套餐。
- 只允许 HTTP/HTTPS 公网来源；禁止内嵌用户名密码、片段和内网/保留地址。DNS 解析结果验证后绑定到实际连接，禁止代理与自动重定向；遇到跳转须填写最终 URL。优先使用 HTTPS。连接超时 5 秒、请求超时 15 秒，不关闭证书验证。
- 网页节点列表仅提供名称、协议等元数据，来源 URL 和节点凭据不回传；未做第三方节点在线探测，不能把“同步成功”理解为“连接健康”。
- 普通用户下载的订阅配置必须包含可连接的第三方节点凭据，因此不能对获授权用户承诺凭据保密。

## 测试与审查

```bash
php tests/external-subscriptions.php
```

测试使用 SQLite 内存数据库、虚构链接和模拟来源，不读取生产数据库。需要安装开发依赖与 pdo_sqlite。不要针对生产连接改写该测试。完整后台绑定回归另运行 `vendor/bin/phpunit`；前端检查在 frontend/admin 执行 `pnpm typecheck && pnpm lint && pnpm test`。

测试覆盖解析、七种协议输出、独立凭据、SS 2022、ALPN、注入防护、SSRF 内网阻断、授权、绑定、缓存失效、同步失败和编辑竞态。可选 `_demo/baseline` 对照是本次验证时从基线提交导出的客户端类（类名加 Baseline 前缀），不属于发布产物。

本次没有真实供应商订阅，因此未验证供应商端节点连通性、真实网络故障恢复或所有客户端实际导入。发布前应在测试套餐中用真实来源完成这些检查。审查结果见 `docs/external-subscriptions-review.md`。

## 上游升级

来源逻辑、页面、路由和数据表按模块保存，但协议生成器仍需保留凭据接入。后台源码在 frontend/admin，构建说明和基线见 frontend/admin/UPSTREAM.md。不能承诺任意未来上游版本自动零冲突。

1. 在独立分支合并上游，不要将 fork 分支直接 reset 到上游。
2. 重点检查 `ClientController`、用户 `ServerController`、`Console/Kernel.php`、`Helper::buildUri`、`Protocols/*` 与 `routes/web.php` 的接入点。
3. 协议生成器必须继续调用 `Output::filter`，使用 external_credential，SS 2022 不派生外部密码，TUIC 使用 external_password，数组输出用 Output::finish 保留 ALPN。
4. 保留三项权限条件、客户端加密/风控流程以及管理 API 的 admin 中间件。
5. 运行回归测试、数据库迁移检查和常用客户端导入测试后，再合并到 fork 的 master。服务器原有 update.sh 会同步自己的 origin/master。

## 停用和回滚

短期停用：在管理页取消所有来源的“启用”，后续请求只下发本站节点。不会使已经下载的外部凭据失效。

代码回滚：回滚本功能提交并按原部署方式重启常驻进程；保留新增表即可，不影响原有表。需要彻底删除时先备份来源与快照，再单独评估执行该迁移的 down；不要直接全库 migrate:rollback，以免撤销其它迁移。
