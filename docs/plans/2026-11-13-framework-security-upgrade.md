# PHP 8.4 / framework security upgrade

User authorized fixing the inherited dependency risks and pushing the changes, then providing fresh BaoTa installation instructions.

## Scope

Upgrade Laravel 8 to a patched Laravel 12, Symfony YAML to a patched maintained release and the transitive filesystem/mailer dependencies. Retain the existing application layout, data tables, APIs, admin build and external subscription functionality. Track composer.lock and retain Composer security blocking without ignored advisories.

## Steps

1. Resolve dependencies with security blocking enabled under a PHP 8.4 platform constraint.
2. Adapt trusted proxies, exception/view types, language paths, mail and filesystem APIs.
3. Exercise application bootstrap, existing and external subscriptions, authentication, orders, mail, scheduler, and installer paths using isolated test data.
4. Replace installation-time dependency updates with locked installation; include the external migration in fresh installs and upgrades. Make failed installations report a nonzero exit status.
5. Run security audit, syntax checks, regression tests and clean-install verification. Record limitations and reproducible BaoTa steps.
6. Commit and push after checks pass; verify the remote revision.

Reference: Laravel official 9, 10, 11 and 12 upgrade guides; Composer security audit and install documentation. Future upstream merges must preserve the dependency/lock policy and repeat regressions.

## Verification completed

Laravel 12.72.0, YAML 7.4.23 and Flysystem 3.36.0 resolved without security exceptions. PHPUnit: 8 tests / 31 assertions; external subscriptions: 122 checks; isolated MariaDB complete install / repeated update / data preservation passed. Fresh no-dev locked install and route loading passed. See docs/framework-security-upgrade.md and docs/baota-install.md. Commit/push status is recorded in Git history.
