# 第三方订阅检查记录

> 此文为首次功能提交的历史记录。后续已执行 Laravel 12 安全升级；当前版本、审计和安装方式以 docs/framework-security-upgrade.md 和 docs/baota-install.md 为准，下面“原有依赖风险”不再代表当前锁定依赖。

日期：2026-11-13。运行环境：PHP 8.4.27，Laravel 8.83.29，SQLite 内存测试数据库。对照基线：336987cc。

## 验证结果

- 102 项功能与安全断言通过；额外 20 个原有客户端生成器与 Git 基线的本站节点输出逐项一致，共 122 项。
- 35 个新增或修改的 PHP/Blade 文件通过语法检查，git diff --check 通过；实际 Blade 模板渲染通过。
- 七种协议解析、Base64、错误/数组参数、换行与行式配置分隔符、第三方 UUID/密码、TUIC 双凭据、SS 2022 不派生密码、ALPN 保留、URI 地址重写。
- 公网地址筛选、下载器直接拒绝回环/链路本地地址；TLS 校验开启、重定向关闭、连接绑定到已验证 IP，响应大小与请求时长受限。
- 有效期、封禁、剩余流量、套餐关联隔离；同来源跨套餐共享；失败缓存、24 小时失效、停用即时生效；编辑竞态不会让旧请求覆盖新配置。
- 实际注册的管理员 API：未登录及普通用户返回 403；新增、编辑、绑定、解绑、删除；不存在套餐返回 422；过期编辑版本返回 409。
- URL 和快照加密；列表与网页元数据不含来源令牌/节点凭据；同步错误不回显原始订阅正文。
- 管理页使用测试数据在浏览器检查手机/桌面布局、新增表单、编辑回填和套餐多选；页面文本使用 textContent 构建，不把供应商内容作为 HTML。

## 修复与兼容处理

- 兼容旧生成器的 networkSettings/tlsSettings 与新版 snake_case 字段，补齐别名，避免传输参数遗漏。
- 独立保留 TUIC UUID 与密码，外部 SS 2022 绕过本站用户密码派生。
- 同步结果按 revision 条件更新，编辑/删除期间返回的旧请求不再覆盖配置。
- 行式输出对无法安全表达的参数保守跳过；不完整的协议参数不会伪装成可用节点。
- 风控受限用户不追加外部节点，避免原始分享 URI 绕过假地址保护。

## 原有依赖风险（本次未升级）

用户明确选择保留框架，只在隔离本地测试环境临时允许安装旧依赖。composer.json 的生产安全配置没有改动。仓库忽略 composer.lock，本次审计反映的是测试时解析出的版本，生产实际版本需另行核对。

`composer audit --locked` 检出 11 条公告：

| 依赖 | 测试版本 | 公告数 |
| --- | --- | --- |
| laravel/framework | 8.83.29 | 5 |
| league/flysystem | 1.1.10 | 1 |
| symfony/yaml | 4.4.45 | 5 |

Laravel 公告包括 TokenGuard 非字符串凭据鉴权绕过、调试页 XSS、临时签名 URL、邮件规则 CRLF 与文件校验问题。新增管理 API 使用项目现有 AuthService/admin 中间件，不使用 TokenGuard；这不构成对整个站点无漏洞的保证。

- https://packagist.org/packages/laravel/framework/advisories
- https://packagist.org/packages/league/flysystem/advisories
- https://packagist.org/packages/symfony/yaml/advisories

新模块只解析 URI/JSON，不解析供应商 YAML，也不导入供应商规则或执行脚本。现有客户端生成器仍使用仓库 YAML 模板及旧库。Swiftmailer 还被标记为 abandoned。PHP 8.4 上旧框架存在弃用提示；测试只屏蔽弃用提示，警告、未定义字段和异常会导致失败。

## 尚未覆盖

- 真实供应商 HTTP/DNS 故障、真实节点连接、全部客户端版本的实际导入与连通性。
- 生产 MySQL/Redis/Webman 部署与高并发压力测试（本次数据库集成为 SQLite）。
- 任意未来上游代码合并兼容；须遵循部署文档的升级回归步骤。

以上为有范围的代码检查和自动化测试，不是“无漏洞证明”。未修改支付、订单、本站流量统计、原有数据表或生产配置。
