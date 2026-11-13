#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PHP_BIN="${PHP_BIN:-php}"
"$PHP_BIN" -r 'exit(PHP_VERSION_ID >= 80400 ? 0 : 1);' || { echo 'PHP 8.4+ is required' >&2; exit 1; }
if [ ! -f composer.phar ]; then
    curl -fL https://getcomposer.org/composer-stable.phar -o composer.phar
fi
"$PHP_BIN" composer.phar install --no-dev --prefer-dist --optimize-autoloader --no-interaction
"$PHP_BIN" composer.phar audit --locked --no-dev --no-interaction
"$PHP_BIN" artisan v2board:install
