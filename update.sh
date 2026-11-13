#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PHP_BIN="${PHP_BIN:-php}"
"$PHP_BIN" -r 'exit(PHP_VERSION_ID >= 80400 ? 0 : 1);' || { echo 'PHP 8.4+ is required' >&2; exit 1; }
git rev-parse --git-dir >/dev/null
git diff --quiet && git diff --cached --quiet || { echo 'Commit or back up tracked local changes first' >&2; exit 1; }
git pull --ff-only origin master
if [ ! -f composer.phar ]; then
    curl -fL https://getcomposer.org/composer-stable.phar -o composer.phar
fi
"$PHP_BIN" -r 'foreach (["bootstrap/cache/packages.php", "bootstrap/cache/services.php"] as $file) { if (is_file($file) && !unlink($file)) { exit(1); } }'
"$PHP_BIN" composer.phar install --no-dev --prefer-dist --optimize-autoloader --no-interaction
"$PHP_BIN" composer.phar audit --locked --no-dev --no-interaction
"$PHP_BIN" artisan view:clear
"$PHP_BIN" artisan route:clear
"$PHP_BIN" artisan v2board:update
echo 'Updated. Reload PHP-FPM / restart Webman if applicable; Supervisor should restart Horizon.'
