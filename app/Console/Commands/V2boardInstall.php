<?php
namespace App\Console\Commands;
use Illuminate\Console\Command;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Utils\Helper;

class V2boardInstall extends Command
{
    protected $signature = 'v2board:install';
    protected $description = '在空数据库安装 V3Board';
    public function handle()
    {
        try {
            if (is_file(base_path('.env'))) {
                $this->error('检测到 .env，拒绝覆盖安装。已有站点请使用 v2board:update。');
                return self::FAILURE;
            }
            $settings = [
                'APP_KEY' => 'base64:' . base64_encode(Encrypter::generateKey('AES-256-CBC')),
                'DB_HOST' => $this->ask('请输入数据库地址', '127.0.0.1'),
                'DB_PORT' => $this->ask('请输入数据库端口', '3306'),
                'DB_DATABASE' => $this->ask('请输入数据库名'),
                'DB_USERNAME' => $this->ask('请输入数据库用户名'),
                'DB_PASSWORD' => $this->secret('请输入数据库密码') ?? '',
            ];
            foreach ($settings as $value) {
                if (!is_string($value) || preg_match('/[\x00-\x1f\x7f]/', $value)) throw new \RuntimeException('数据库配置包含无效控制字符');
            }
            if (!$settings['DB_DATABASE'] || !$settings['DB_USERNAME'] || !ctype_digit($settings['DB_PORT'])) throw new \RuntimeException('数据库名称、用户名和端口无效');
            config(['database.default' => 'mysql', 'app.key' => $settings['APP_KEY']]);
            foreach (['host','port','database','username','password'] as $key) config(['database.connections.mysql.' . $key => $settings['DB_' . strtoupper($key)]]);
            DB::purge('mysql');
            DB::connection()->getPdo();
            if (DB::select('SHOW TABLES')) throw new \RuntimeException('数据库非空，拒绝导入安装 SQL，请创建独立空数据库');
            $email = $this->ask('请输入管理员邮箱');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new \RuntimeException('管理员邮箱格式无效');
            $this->saveEnvironment($settings);
            $sql = file_get_contents(base_path('database/install.sql'));
            if (!$sql) throw new \RuntimeException('安装 SQL 不存在');
            DB::unprepared($sql);
            if ($this->call('migrate', ['--path' => ['database/migrations/2026_11_13_000001_create_external_subscriptions.php', 'database/migrations/2026_11_13_000002_add_external_subscription_node_prefix.php', 'database/migrations/2026_11_13_000003_add_external_subscription_filters.php'], '--force' => true]) !== 0) throw new \RuntimeException('第三方订阅数据表初始化失败');
            $password = Helper::guid(false);
            $user = new User();
            $user->email = $email;
            $user->password = password_hash($password, PASSWORD_DEFAULT);
            $user->uuid = Helper::guid(true);
            $user->token = Helper::guid();
            $user->is_admin = 1;
            $user->saveOrFail();
            if ($this->call('config:cache') !== 0) throw new \RuntimeException('配置缓存失败');
            $this->info('安装成功（包含第三方订阅数据表）');
            $this->line('管理员邮箱：' . $email);
            $this->line('管理员密码：' . $password);
            $this->line('后台路径：/' . hash('crc32b', $settings['APP_KEY']));
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('安装失败：' . $e->getMessage());
            $this->warn('不要对非空数据库重试安装。若已经生成 .env，请保留并排查。');
            return self::FAILURE;
        }
    }
    private function saveEnvironment(array $settings): void
    {
        $text = file_get_contents(base_path('.env.example'));
        foreach ($settings as $key => $value) {
            $quoted = str_replace('$', '\\$', json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            $text = preg_replace_callback('/^' . preg_quote($key, '/') . '=[^\r\n]*/m', function () use ($key, $quoted) { return $key . '=' . $quoted; }, $text);
        }
        if (file_put_contents(base_path('.env'), $text, LOCK_EX) === false) throw new \RuntimeException('无法写入 .env');
        @chmod(base_path('.env'), 0600);
    }
}
