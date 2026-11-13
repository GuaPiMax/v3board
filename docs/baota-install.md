# 宝塔全新安装（PHP 8.4 / Laravel 12）

适用于安全升级后的仓库。以下路径按 console.v3board.top 编写，不要再使用旧示例 /www/wwwroot/v3board。

## 1. 宝塔环境

安装 Nginx、PHP 8.4、MySQL 8.0/8.4 或兼容 MariaDB、Redis、Supervisor 管理器。站点 PHP 版本选择 8.4。

PHP 需要 curl、openssl、mbstring、fileinfo、pdo_mysql、xml/dom、ctype、tokenizer、session；安装 zip、bcmath、redis 扩展。CLI 需要 pcntl 与 posix，用于 Horizon/Workerman。不要在生产环境使用 --ignore-platform-reqs。

```bash
/www/server/php/84/bin/php -v
/www/server/php/84/bin/php -m
/www/server/php/84/bin/php --ini
```

Composer 所需 putenv、proc_open、proc_get_status、proc_close、escapeshellarg、escapeshellcmd 不得在 CLI 中禁用。可复制 /www/server/php/84/etc/php.ini 为同目录 php-cli.ini，仅从 CLI 的 disable_functions 中移除所需项，保留 Web PHP-FPM 设置及其他禁用函数。Horizon 所需 pcntl/posix 函数也必须在 CLI 可用。重复加载 mbstring 时保留一份有效扩展声明。若实际配置路径不同，按 --ini 输出处理。

## 2. 准备空目录与空数据库

宝塔绑定域名 console.v3board.top，网站根目录 /www/wwwroot/console.v3board.top，创建独立空数据库并保存登录信息。安装器会拒绝非空数据库，不要清理有业务数据的数据库。

已有下载目录可以先在宝塔文件管理器改名备份，再重新创建站点目录；不要删除 PHP 安装目录、其他网站或数据库。若已有 .env、配置、上传或数据库数据，请先备份。本教程不适用于覆盖已有生产站点。

清理/改名后，在终端执行：

```bash
cd /www/wwwroot
git clone https://github.com/GuaPiMax/v3board.git console.v3board.top
cd /www/wwwroot/console.v3board.top
curl -fL https://getcomposer.org/composer-stable.phar -o composer.phar
chown -R www:www /www/wwwroot/console.v3board.top
```

git clone 目标目录应不存在或为空；若宝塔自动创建了 index.html/.user.ini，先确认其为新站点默认文件，再通过文件管理器处理，不要强制递归删除。

## 3. 安装已锁定依赖并审计

```bash
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php composer.phar install --no-dev --prefer-dist --optimize-autoloader --no-interaction'
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php composer.phar audit --locked --no-dev'
```

应显示 Installing dependencies from lock file，审计应无安全公告。不要删除 composer.lock、运行 composer update、使用 --no-security-blocking、增加安全忽略项。若将来出现新安全公告，停下并更新/测试依赖。

## 4. 初始化

不要预先复制 .env.example，也不要预先运行 key:generate；安装器负责生成 .env 和 APP_KEY。

```bash
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php artisan v2board:install'
```

依次输入数据库地址（通常 127.0.0.1）、端口（通常 3306）、数据库名、用户名、密码、管理员邮箱。数据库密码输入不回显。保存输出的管理员邮箱、随机密码、后台路径。一次安装包含原系统表和第三方订阅表，不需要另跑迁移。成功应明确显示安装成功；失败会返回非零退出码，不能继续后续步骤。

安装失败若已产生 .env/部分表，不要反复删除 .env 重试，先查看错误并确认是否应新建另一空库。安装器拒绝覆盖已有 .env 或非空数据库。

## 5. 网站与 HTTPS

宝塔网站设置：网站目录 /www/wwwroot/console.v3board.top，运行目录 /public，PHP 8.4。伪静态：

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
```

不要重复添加同名 location。申请 SSL 后启用 HTTPS。open_basedir 应允许整个项目目录及所需临时目录，而不只是 public。

编辑项目 .env，保留数据库配置和生成的 APP_KEY，设置：

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://console.v3board.top
CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
HORIZON_MAX_PROCESSES=6
```

Redis 有密码时填写真实密码。保持 Redis 仅供本机访问。低内存服务器可将 HORIZON_MAX_PROCESSES 调为 2；此项为队列工作进程上限，不是 Supervisor 启动 Horizon 的数量。默认 LOG_CHANNEL=stack 写入 storage/logs；如需原有后台数据库日志可设 LOG_CHANNEL=mysql（已做请求体/令牌脱敏）。

```bash
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php artisan config:cache'
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php artisan view:clear'
```

## 6. 定时任务与队列

宝塔计划任务新增 Shell，每分钟运行：

```bash
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php artisan schedule:run' >> /www/wwwroot/console.v3board.top/storage/logs/schedule.log 2>&1
```

不要单独再加第三方订阅同步定时任务，调度器每 30 分钟会运行一次。

Supervisor 新增：名称 v3board-horizon；工作目录 /www/wwwroot/console.v3board.top；启动命令 /www/server/php/84/bin/php artisan horizon；用户 www；进程数 1；开启自动启动和重启。PHP-FPM 模式不需要配置 Webman 或 6600 端口反代。

## 7. 验收

先以 www 执行部署自检（不输出密码或令牌）：

```bash
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php artisan v3board:doctor'
```

FAIL 项目应先排查。此命令只检查 CLI，PHP-FPM/Nginx、Supervisor 和定时任务仍需按下面步骤确认。

访问安装器输出的后台路径，登录并修改管理员密码，在系统设置中保存正确 HTTPS 站点地址。创建测试套餐。

第三方订阅管理： https://console.v3board.top/你的后台路径/external-subscriptions 。新增来源、绑定套餐、手动同步，用有效测试用户导入常用客户端并验证连接。

```bash
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php artisan horizon:status'
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php artisan schedule:list'
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && /www/server/php/84/bin/php artisan external-subscriptions:sync'
```

不要把 .env、数据库密码、管理员密码、真实订阅 URL 发到公开日志或聊天中。

## 8. 以后升级

备份数据库、.env、config/v2board.php、主题及上传，保持 origin 指向自己的 fork。以站点文件所有者运行：

```bash
su -s /bin/bash www -c 'cd /www/wwwroot/console.v3board.top && PHP_BIN=/www/server/php/84/bin/php bash update.sh'
```

脚本仅 fast-forward 更新，遇到本地已跟踪文件修改会停止，不再 reset --hard；使用锁定依赖安装并审计，不运行 composer update。脚本成功后按实际部署方式重载 PHP-FPM/重启 Webman。Horizon 由 Supervisor 在终止通知后重启。
