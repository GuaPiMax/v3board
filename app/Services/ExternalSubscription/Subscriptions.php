<?php
namespace App\Services\ExternalSubscription;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class Subscriptions
{
    public static function eligible($user): bool
    {
        return !empty($user['plan_id']) && empty($user['banned']) &&
            ($user['expired_at'] === null || $user['expired_at'] > time()) &&
            (float)$user['transfer_enable'] > (float)$user['u'] + (float)$user['d'];
    }

    public function nodes($user): array
    {
        if (!self::eligible($user)) return [];
        try {
            if (!Schema::hasTable('v2_external_subscription')) return [];
            $sources = DB::table('v2_external_subscription as s')
                ->join('v2_external_subscription_plan as p', 'p.subscription_id', '=', 's.id')
                ->where('p.plan_id', $user['plan_id'])->where('s.enabled', 1)
                ->where('s.synced_at', '>', time() - 86400)->select('s.*')->lazyById(1, 's.id', 'id');
            $result = [];
            foreach ($sources as $source) {
                try { $nodes = json_decode(Crypt::decryptString($source->snapshot), true, 64, JSON_THROW_ON_ERROR); }
                catch (\Throwable $e) { continue; }
                foreach ($nodes as $i => $node) {
                    $node['id'] = -($source->id * 1001 + $i + 1);
                    $node['name'] = '外部 ' . $source->id . '-' . ($i + 1) . ' | ' . $node['name'];
                    $node['updated_at'] = $source->synced_at;
                    $node['cache_key'] = 'external-' . $source->id . '-' . $source->synced_at . '-' . $i;
                    $result[] = $node;
                    if (count($result) >= 3000) return $result;
                }
            }
            return $result;
        } catch (\Throwable $e) {
            // Do not let an uninstalled/unavailable extension break native subscriptions.
            return [];
        }
    }

    public function metadata($user): array
    {
        return array_map(function ($n) {
            return ['id' => $n['id'], 'type' => $n['type'], 'name' => $n['name'], 'rate' => 1,
                'external' => true, 'host' => 'hidden.example.com', 'port' => 0,
                'is_online' => 0, 'last_check_at' => 0, 'cache_key' => $n['cache_key']];
        }, $this->nodes($user));
    }

    public function sync(int $id): bool
    {
        $lock = Cache::lock('external-subscription-sync-' . $id, 120);
        if (!$lock->get()) return false;
        try {
            $source = DB::table('v2_external_subscription')->where('id', $id)->first();
            if (!$source || !$source->enabled) return false;
            $query = DB::table('v2_external_subscription')->where('id', $id)->where('revision', $source->revision)->where('enabled', 1);
            try {
                $url = Crypt::decryptString($source->url);
                $parsed = app(Parser::class)->parse(app(Fetcher::class)->fetch($url));
                if (!$parsed['nodes']) throw new \RuntimeException('没有可用节点；' . implode('；', $parsed['errors']));
                $updated = $query->update(['snapshot' => Crypt::encryptString(json_encode($parsed['nodes'], JSON_THROW_ON_ERROR)),
                    'synced_at' => time(), 'attempted_at' => time(), 'node_count' => count($parsed['nodes']),
                    'status' => mb_substr(implode('；', array_filter([
                        $parsed['errors'] ? implode('；', $parsed['errors']) : '同步成功',
                        Output::diagnostics($parsed['nodes'])
                    ])), 0, 6000)]);
                return $updated > 0;
            } catch (\Throwable $e) {
                // Only expose our own bounded, credential-free errors.
                $message = in_array(get_class($e), [\RuntimeException::class, \InvalidArgumentException::class, \LengthException::class], true)
                    ? $e->getMessage() : '同步失败，请检查来源、网络和加密配置';
                $query->update(['attempted_at' => time(), 'status' => mb_substr($message, 0, 2000)]);
                return false;
            }
        } finally { $lock->release(); }
    }
}
