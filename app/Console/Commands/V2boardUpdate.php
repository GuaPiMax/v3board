<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class V2boardUpdate extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'v2board:update';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'v2board 更新';

    /**
     * Create a new command instance.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        \Artisan::call('config:cache');
        DB::connection()->getPdo();
        $file = \File::get(base_path() . '/database/update.sql');
        if (!$file) {
            abort(500, '数据库文件不存在');
        }
        $sql = \App\Utils\SqlStatements::parse($file);
        if (!is_array($sql)) {
            abort(500, '数据库文件格式有误');
        }
        $this->info('正在导入数据库请稍等...');
        $skipped = 0;
        foreach ($sql as $item) {
            if (trim($item) === '') continue;
            try {
                DB::unprepared($item);
            } catch (\Illuminate\Database\QueryException $e) {
                if (!in_array((int)($e->errorInfo[1] ?? 0), [1050, 1054, 1060, 1061, 1072, 1091, 1146], true)) throw $e;
                $skipped++;
            }
        }
        if ($skipped) $this->line('跳过已存在或已移除的历史结构变更：' . $skipped);
        if ($this->call('migrate', ['--path' => 'database/migrations/2026_11_13_000001_create_external_subscriptions.php', '--force' => true]) !== 0) return self::FAILURE;
        \Artisan::call('horizon:terminate');
        $this->info('更新完毕，队列服务已重启，你无需进行任何操作。');
    }
}
