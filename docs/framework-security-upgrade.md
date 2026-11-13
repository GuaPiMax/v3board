# 框架安全升级记录

2026-11-13；目标运行环境 PHP 8.4。基线为第三方订阅提交 bcbc384b。

## 修复

- Laravel 8.83.29 → 12.72.0；Symfony YAML 4.4.45 → 7.4.23；Flysystem 1.1.10 → 3.36.0；Swiftmailer 替换为 Symfony Mailer 7.4.22。
- 移除过时 Ignition/Fideloper Proxy；适配内置 TrustProxies、ViewException、Monolog 3 LogRecord 和旧翻译目录。
- Horizon 5.51.0 同时覆盖 production/local 环境；移除在配置加载时探测硬件的 Linfo，工作进程上限通过环境变量明确配置。PHP 配置缓存不再依赖 WMI/机器内存探测。
- 保留既有邮件配置格式，适配 SSL SMTP scheme，常驻队列发送邮件前清除旧传输实例；测试邮件响应不再返回 SMTP 配置/密码。
- 数据库日志不记录请求体、查询串或异常对象中的 SQL 绑定，适配 Monolog 3 时间与记录类型。
- composer.lock 纳入版本控制，删除既有公告忽略项，保持安全阻断；平台按 PHP 8.4.0 解析。安装/更新脚本使用 composer install + audit，不再更新依赖、临时 require 包、删除 lock 或强制丢弃服务器代码。
- 新安装只允许空库，正确执行完整 SQL，失败返回非零状态，密码隐藏输入，安全引用 dotenv 值，并自动迁移第三方订阅表。
- 历史更新脚本使用支持引号、注释、DELIMITER 的拆分器；仅跳过已存在/已移除的历史结构错误，其他 SQL 错误会停止。历史统计迁移限制到当前数据库，防止匹配其他库的同名索引。

## 验证

- Composer validate --strict 通过；安全阻断开启的依赖解析成功；composer audit --locked 未检出安全公告（包含开发依赖）。
- PHPUnit 11：9 个测试、37 项断言通过，覆盖登录/JWT、错误凭据、生产环境 Horizon 管理员授权及越权拒绝、订单支付开通与重复回调、Symfony 邮件传输、队列名称、调度、日志脱敏及 SQL 解析。
- 第三方订阅独立回归：122 项检查通过，包括原有生成器对照。
- 本地独立 MariaDB 11.4.9：完整安装 SQL、39 张表、管理员创建、第三方迁移、配置缓存、dotenv 密码往返、拒绝重复安装与重复更新通过；统计哨兵数据保留。测试只创建和清理随机命名的测试数据库。
- 全新目录的 --no-dev 锁定安装、框架启动和路由加载单独验证；Windows 本地安装只忽略 Linux 专属 pcntl/posix，生产命令没有扩展或安全绕过。

## 边界

后续部署排障发现 /monitor/api/stats 使用默认 Laravel 会话 Gate 时拒绝本站 JWT 管理员，后台前端收到 403 会清除登录状态。已改为由 Horizon 授权回调验证本站 AuthService 的真实管理员令牌，保留 admin 中间件，不信任请求传入的 user 字段，也不增加 local 环境鉴权绕过。新增测试先重现有效管理员收到 403，再验证修复后的管理员成功及普通用户/无令牌/伪造身份拒绝；仅统计控制器使用替身，实际路由和鉴权中间件正常运行。

审计零公告只表示执行时锁定依赖未命中已知公告，不等于整个项目无漏洞。没有真实支付商户、SMTP、节点供应商或用户服务器访问，本次不执行真实扣款、发送邮件或远程部署。SQLite + MariaDB 测试不能替代生产 MySQL 版本与负载验收；Horizon/Workman 在本机 Windows 下不运行 Linux 多进程服务，部署后需检查 Supervisor 状态。PHP 8.5、第三方自定义主题和任意未来上游合并仍需各自测试。

此升级提高最低 PHP 版本到 8.4，后续上游合并须保留 composer.json/lock、安全策略、兼容接入和测试。新安装说明：docs/baota-install.md。

参考：
- https://laravel.com/docs/9.x/upgrade
- https://laravel.com/docs/10.x/upgrade
- https://laravel.com/docs/11.x/upgrade
- https://laravel.com/docs/12.x/upgrade
- https://getcomposer.org/doc/01-basic-usage.md#installing-dependencies
