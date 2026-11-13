<img src="https://avatars.githubusercontent.com/u/56885001?s=200&v=4" alt="logo" width="130" height="130" align="right"/>

# V3Board - V2Board 增强版

基于 [wyx2685/v2board](https://github.com/wyx2685/v2board) 二次开发，定期合并上游，数据库与上游兼容，可以从原版无缝迁移。

## 仓库组成

| 部分 | 位置 | 说明 |
|------|------|------|
| 后端 | 本仓库（Laravel） | 接口、定时任务、Telegram 机器人、数据库脚本 |
| 用户端前端 | 本仓库 `public/theme/default` | 与上游一致 |
| 后台管理前端 | [codeman857/v2board-admin](https://github.com/codeman857/v2board-admin) | React 19 + antd 6，源码单独维护；本仓库只保存构建产物 `public/assets/admin`，由 `build-admin.sh` 生成，部署和升级都不需要 Node |
| 节点端 | [修改版 V2bX](https://github.com/wyx2685/V2bX)、[v2node](https://github.com/wyx2685/v2node) | 与上游相同 |

## 相对上游新增的功能

### 风控中心（InsiderGuard）

后台「用户 → 风控中心」，用于排查订阅泄露和异常账号。

- 记录登录（仅密码登录）与订阅拉取的来源 IP、UA（同一用户、IP、UA 按小时合并计数，不会撑大表），以及向每个用户下发过哪些节点（每人每节点一行）
- 风险用户：按时段统计订阅次数与来源 IP 数并评分，达到阈值标为高风险
- 节点异常登记：查看异常前 24 小时内被下发过该节点的候选账号与时间线（按首次 / 最近下发时间估算，可能多列），只是线索，不能证明泄露
- 节点 TCP 健康探测（可选）：每 5 分钟探测一次，连续两次不通时通过 Telegram 通知管理员（需开启机器人并绑定管理员，同一告警默认 2 小时内只发一次）
- 人工审核与限制：限制不封号，被限制的用户拉订阅时节点入口换成假地址（默认按用户生成一个固定的、不可路由的保留段 IPv4（240～254 开头），也可填自己的蜜罐；SNI、Host 头、obfs host 一并替换，节点名恰好是地址时也替换），解除后恢复。只影响订阅与 App 配置接口，不影响登录后的用户面板
- 审计数据保留 1～365 天（默认 3；每个活跃设备每天约 24 行、每行约 0.4 KB，万级用户不建议超过 7 天），每小时自动清理；数据含 IP 与 UA，请按当地法规设置保留期
- 设置在「风控中心 → 风控设置」；定时任务已加入调度，不需要另加 crontab，排障时可手动执行 `php artisan insider-guard:health`、`php artisan insider-guard:cleanup`；缓存依赖 Redis；站点在反向代理 / CDN 后面且未配置信任代理时，拿到的来源 IP 是代理地址，IP 维度的评分无效

### 订阅

- 订阅加密：订阅内容用 AES-CBC 加密后以 Base64 输出，可按 User-Agent 关键词和套餐 ID 限定范围，IV 优先取请求头 `X-IV`
- NextinEncrypted 协议：对指定 UA 和版本的客户端下发 AES-256-GCM 加密的 Clash.Meta 配置
- 订阅域名重写规则：客户端 UA 命中关键词时，把节点中的指定域名替换为指定 IP 下发
- 订阅节点 UA 白名单：规则里出现过的节点只对命中 UA 的客户端下发，其他节点不受影响
- 无订阅用户也可以查看节点列表
- mihomo 系订阅开启 `support-x25519mlkem768`；只按 `sing-box` 关键字识别 sing-box，避免 UA 里带 sing 的系统语言名被误判；Shadowrocket 订阅状态行正确处理永久有效用户

订阅加密、域名重写、节点 UA 白名单在「系统配置 → 订阅」里设置，其余为固定行为。

### 订单与订阅周期

- 提前续期记录：用户流量用尽后提前开启下一计费周期（扣除订阅时长）的记录，后台「财务 → 提前续期记录」
- 订阅覆盖记录：购买不同订阅导致原订阅被覆盖时，记录覆盖前的到期时间与剩余流量，后台「财务 → 订阅覆盖记录」，订单列表和详情可直接跳转查看
- 已取消订单补单：已取消的订单可以标记为已支付并由系统开通，备注必填并作为标注显示在订单上
- 订单列表显示下单用户邮箱；修复订单取消与支付回调之间的竞态；支付回调核对支付方式，避免重复开通

### 用户与后台

- 用户列表显示距下次流量重置的天数，编辑抽屉同步提示
- 仪表盘新增总用户、累计付费用户、有效付费用户（含占比），「实时注册」改为「今日注册」
- 用户端支持更换邮箱
- 移除未完成的 staff 接口（存在越权读取用户信息的风险）

### 签到系统

用户可通过每日签到获得随机流量奖励，签到通过减少已用流量实现，续费时不会重置。

- 普通签到（`/sign`）：每日一次，随机获得 10MB ~ 1GB 流量
- 运气签到（`/sign2 <数值><单位>`）：输入想要赌的流量（如 `100GB`），获得 -100% 到 +100% 的浮动流量，支持 MB 和 GB
- 支持 Web 接口和 Telegram 机器人两种方式
- 「系统配置 → 站点」可分别开关普通签到和运气签到
- 命令 `php artisan checkin:clear-cache` 清理签到缓存（未加入调度，需要时手动执行）

### OAuth 第三方登录

- Google OAuth 登录 / 注册：完整的 OAuth 2.0 流程，新用户自动注册并发送含随机密码的欢迎邮件，老用户直接登录
- Telegram 登录：用户向机器人发送验证码完成登录，前端轮询接口检查登录状态
- 支持邀请码关联
- Google 登录需要在 `.env` 配置 `GOOGLE_CLIENT_ID` 与 `GOOGLE_CLIENT_SECRET`

### 节点监控增强

| 功能 | 原版 | 增强版 |
|------|------|--------|
| 掉线检测 | 30 分钟超时立即通知 | 5 分钟超时，连续 5 次才通知 |
| 重复通知 | 每次检测都通知 | 24 小时内不重复 |
| 恢复通知 | 无 | 节点恢复时发送通知 |
| 状态报告 | 无 | 定时发送全节点状态报告 |

- 连续掉线计数，避免短暂网络波动造成误报
- 状态报告频率在「系统配置 → 节点」设置（单位小时，0 为不发送），隐藏节点（`show=0`）不参与

### Telegram 机器人扩展

| 命令 | 功能 | 状态 |
|------|------|------|
| `/start` | 欢迎消息和快捷指令 | 新增 |
| `/help` | 显示帮助信息 | 新增 |
| `/info` | 查询账户信息 | 新增 |
| `/sign` | 普通签到 | 新增 |
| `/sign2` | 运气签到 | 新增 |
| `/login <验证码>` | Telegram 登录验证 | 新增 |
| `/bind` | 绑定账号 | 增强 |
| `/unbind` | 解绑账号 | 原有 |
| `/traffic` | 查询流量 | 原有 |
| `/getlatesturl` | 获取最新网址 | 原有 |
| `/replyticket` | 回复工单 | 原有 |

TelegramService 新增 MarkdownV2 安全转义（保护代码块）、统一的 `sendReply()`，以及更完整的错误处理与日志。命令 `php artisan telegram:update-commands` 把命令菜单同步到 Telegram（更换机器人后执行一次）。

### 邮件

- 邮件提醒可配置：到期前提醒天数与次数、流量使用阈值、新用户注册后是否默认开启（「系统配置 → 邮件提醒」），由定时任务 `send:remindMail` 发送
- 新增 fashion 邮件主题（完整 6 个模板）和 OAuth 用户欢迎邮件模板 `googleWelcome.blade.php`

## 后台管理前端

后台页面源码在 [codeman857/v2board-admin](https://github.com/codeman857/v2board-admin)，是 [sinalphabeta/v2board-admin](https://github.com/sinalphabeta/v2board-admin) 的 fork，本仓库独有的页面（风控中心、提前续期记录、订阅覆盖记录、各项新增设置等）都在那里维护。

- 本仓库的 `resources/views/admin.blade.php` 只加载 `public/assets/admin/assets/admin.js`、`admin.css`，以及可选的 `public/assets/admin/custom.css`（站点自己的样式覆盖，不受版本控制）；旧的 `custom.js` 钩子已随 umi 产物一起移除，之前靠它改的东西要改到 v2board-admin 源码里
- 静态资源的缓存版本号取 `admin.js` 与 `admin.css` 的内容哈希，前端重新构建后自动失效，不依赖后端版本号
- 发布流程（开发机需要 Node ≥ 22.22 与 pnpm 11，服务器不需要）：

```shell
# 1. 在 v2board-admin 里改好、提交并推送
# 2. 回到本仓库构建并放入 public/assets/admin（源码仓库有未提交改动时脚本会拒绝）
./build-admin.sh ../v2board-admin
# 3. 把 public/assets/admin 的变化和对应的后端改动一起提交
```

- `public/assets/admin/SOURCE` 记录产物来自哪个提交，便于对照源码；commit 带 `-dirty` 的是用 `ALLOW_DIRTY=1` 从未提交源码构建的联调产物，不要提交
- 本地联调：在 v2board-admin 里建 `config.local.js`，`host` 指向本地后端、`secure_path` 填后台路径，然后 `pnpm dev`

## 安装与升级

当前分支使用 **PHP 8.4 + Laravel 12**，已提交经过测试的 composer.lock。需要 MySQL 兼容数据库、Redis、PHP CLI 的 pcntl/posix 与项目要求的扩展。后台前端构建产物已包含，服务器不需要 Node。

宝塔全新安装请按 [完整安装步骤](docs/baota-install.md)，安全升级范围与测试见 [升级记录](docs/framework-security-upgrade.md)。第三方订阅管理见 [功能说明](docs/external-subscriptions.md)。

全新安装使用独立空数据库；以站点文件所有者运行（先确认 CLI PHP 版本）：

```bash
PHP_BIN=/www/server/php/84/bin/php bash init.sh
```

安装器自动生成 .env、导入原系统 SQL、创建第三方订阅表并输出管理员账号和后台路径。不要预先创建 .env，不要对非空数据库运行安装器。

升级前备份数据库、.env、站点配置与上传；原有 PHP 7/8.0 环境需要先升级到 PHP 8.4，再运行：

```bash
PHP_BIN=/www/server/php/84/bin/php bash update.sh
```

脚本使用 fast-forward 拉取和 composer install + audit，不再删除锁文件、重新解析依赖或 reset --hard。出现本地文件改动、安全公告、缺少扩展或 SQL 错误时会停止。完成后重载 PHP-FPM；使用 Webman 的站点另需重启常驻进程。Horizon 应由 Supervisor 管理，原有每分钟 schedule:run 必须保留。

合并上游时保留本分支的依赖与锁定文件、Laravel 兼容改动及第三方订阅接入；在独立分支跑回归后再部署。旧版 merge.sh 含自动处理策略，合并前应先检查其内容及实际冲突，不能保证任意上游版本无冲突。

## 社区与反馈

- Telegram 群组：[@v3board_group](https://t.me/v3board_group)
- 上游文档：[v2board.com](https://v2board.com)
- 提问请按 issue 模板填写，便于跟进
- 感谢 [JetBrains](https://www.jetbrains.com/) 提供的开源项目许可
