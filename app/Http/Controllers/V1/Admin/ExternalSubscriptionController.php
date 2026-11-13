<?php
namespace App\Http\Controllers\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\ExternalSubscription\Fetcher;
use App\Services\ExternalSubscription\Subscriptions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;

class ExternalSubscriptionController extends Controller
{
    public function fetch()
    {
        $rows = DB::table('v2_external_subscription')->orderBy('id')->get(['id','name','node_prefix','enabled','revision','synced_at','attempted_at','status','node_count']);
        $bindings = DB::table('v2_external_subscription_plan')->get()->groupBy('subscription_id');
        foreach ($rows as $row) $row->plan_ids = isset($bindings[$row->id]) ? $bindings[$row->id]->pluck('plan_id')->all() : [];
        return ['data' => $rows, 'plans' => DB::table('v2_plan')->orderBy('id')->get(['id','name'])];
    }

    public function save(Request $request)
    {
        $data = $request->validate(['id' => 'nullable|integer|min:1', 'revision' => 'nullable|integer|min:1',
            'name' => 'required|string|max:100', 'url' => 'nullable|string|max:4096',
            'node_prefix' => ['nullable', 'string', 'max:100', 'not_regex:/[\p{C}\x{2028}\x{2029}]/u'],
            'enabled' => 'required|boolean', 'plan_ids' => 'present|array|max:200',
            'plan_ids.*' => 'required|integer|min:1|distinct|exists:v2_plan,id']);
        if (!empty($data['url'])) {
            try { Fetcher::validateUrl($data['url']); }
            catch (\RuntimeException $e) { abort(422, $e->getMessage()); }
        }
        return DB::transaction(function () use ($data) {
            $values = ['name' => $data['name'], 'enabled' => $data['enabled'], 'updated_at' => time()];
            // Old clients may omit the field; only an explicit empty value clears it.
            if (array_key_exists('node_prefix', $data)) $values['node_prefix'] = $data['node_prefix'] ?? '';
            if (!empty($data['id'])) {
                $row = DB::table('v2_external_subscription')->where('id', $data['id'])->lockForUpdate()->first();
                if (!$row) abort(404);
                if ((int)($data['revision'] ?? 0) !== (int)$row->revision) abort(409, '来源已被修改，请刷新页面后重试');
                $values['revision'] = $row->revision + 1;
                $id = $row->id;
            } else {
                if (empty($data['url'])) abort(422, '请填写订阅链接');
                if (DB::table('v2_external_subscription')->count() >= 100) abort(422, '最多支持 100 个来源');
            }
            if (!empty($data['url'])) {
                $values += ['url' => Crypt::encryptString($data['url']), 'snapshot' => null, 'synced_at' => null,
                    'attempted_at' => null, 'status' => '等待同步', 'node_count' => 0];
            }
            if (isset($id)) DB::table('v2_external_subscription')->where('id', $id)->update($values);
            else $id = DB::table('v2_external_subscription')->insertGetId($values);
            // Recheck after acquiring the source lock: a plan may have been deleted while waiting.
            if (DB::table('v2_plan')->whereIn('id', $data['plan_ids'])->count() !== count($data['plan_ids'])) abort(422, '套餐已删除，请重新选择');
            DB::table('v2_external_subscription_plan')->where('subscription_id', $id)->delete();
            foreach ($data['plan_ids'] as $planId) DB::table('v2_external_subscription_plan')->insert(['subscription_id' => $id, 'plan_id' => $planId]);
            return ['data' => ['id' => $id]];
        });
    }

    public function drop(Request $request)
    {
        $data = $request->validate(['id' => 'required|integer|min:1']);
        DB::transaction(function () use ($data) {
            DB::table('v2_external_subscription')->where('id', $data['id'])->delete();
            DB::table('v2_external_subscription_plan')->where('subscription_id', $data['id'])->delete();
        });
        return ['data' => true];
    }

    public function sync(Request $request)
    {
        $data = $request->validate(['id' => 'required|integer|min:1|exists:v2_external_subscription,id']);
        return ['data' => app(Subscriptions::class)->sync((int)$data['id'])];
    }
}
