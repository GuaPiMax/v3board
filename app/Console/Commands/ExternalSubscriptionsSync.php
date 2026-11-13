<?php
namespace App\Console\Commands;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Services\ExternalSubscription\Subscriptions;

class ExternalSubscriptionsSync extends Command
{
    protected $signature = 'external-subscriptions:sync';
    protected $description = '同步启用的第三方订阅（每个来源独立锁定）';
    public function handle()
    {
        if (!Schema::hasTable('v2_external_subscription')) return 0;
        foreach (DB::table('v2_external_subscription')->where('enabled', 1)->orderBy('id')->pluck('id') as $id) {
            $ok = app(Subscriptions::class)->sync((int)$id);
            $this->line('来源 ' . $id . ($ok ? '：成功' : '：未更新，请查看后台状态'));
        }
        return 0;
    }
}
