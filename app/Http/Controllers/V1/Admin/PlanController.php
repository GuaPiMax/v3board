<?php

namespace App\Http\Controllers\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PlanSave;
use App\Http\Requests\Admin\PlanSort;
use App\Http\Requests\Admin\PlanUpdate;
use App\Models\Order;
use App\Models\Plan;
use App\Models\User;
use App\Services\PlanService;
use App\Services\ExternalSubscription\PlanBindings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlanController extends Controller
{
    public function fetch(Request $request)
    {
        $counts = PlanService::countActiveUsers();
        $plans = Plan::orderBy('sort', 'ASC')->get();
        PlanBindings::attachToPlans($plans);
        foreach ($plans as $k => $v) {
            $plans[$k]->count = 0;
            foreach ($counts as $kk => $vv) {
                if ($plans[$k]->id === $counts[$kk]->plan_id) $plans[$k]->count = $counts[$kk]->count;
            }
        }
        return response([
            'data' => $plans
        ]);
    }

    public function save(PlanSave $request)
    {
        $params = $request->validated();
        $bindingIds = $params['external_subscription_ids'] ?? null;
        $bindingToken = $params['external_binding_token'] ?? null;
        unset($params['external_subscription_ids'], $params['external_binding_token']);
        if ($request->input('id')) {
            $plan = Plan::find($request->input('id'));
            if (!$plan) {
                abort(500, '该订阅不存在');
            }
            DB::beginTransaction();
            // Validate binding conflicts before updating the plan or its users.
            try {
                if ($bindingIds !== null) PlanBindings::save($plan->id, $bindingIds, $bindingToken);
            } catch (\Throwable $e) {
                DB::rollBack();
                throw $e;
            }
            // update user group id and transfer
            try {
                if ($request->input('force_update')) {
                    User::where('plan_id', $plan->id)->update([
                        'group_id' => $params['group_id'],
                        'transfer_enable' => $params['transfer_enable'] * 1073741824,
                        'device_limit' => $params['device_limit'],
                        'speed_limit' => $params['speed_limit']
                    ]);
                }
                $plan->update($params);
            } catch (\Exception $e) {
                DB::rollBack();
                abort(500, '保存失败');
            }
            DB::commit();
            return response([
                'data' => true
            ]);
        }
        DB::transaction(function () use ($params, $bindingIds) {
            $plan = Plan::create($params);
            if (!$plan) abort(500, '创建失败');
            if ($bindingIds !== null) PlanBindings::save($plan->id, $bindingIds, null, true);
        });
        return response([
            'data' => true
        ]);
    }

    public function drop(Request $request)
    {
        if (Order::where('plan_id', $request->input('id'))->first()) {
            abort(500, '该订阅下存在订单无法删除');
        }
        if (User::where('plan_id', $request->input('id'))->first()) {
            abort(500, '该订阅下存在用户无法删除');
        }
        if ($request->input('id')) {
            $plan = Plan::find($request->input('id'));
            if (!$plan) {
                abort(500, '该订阅ID不存在');
            }
        }
        return DB::transaction(function () use ($plan) {
            DB::table('v2_external_subscription')->orderBy('id')->lockForUpdate()->get(['id']);
            $ids = DB::table('v2_external_subscription_plan')->where('plan_id', $plan->id)->pluck('subscription_id')->all();
            DB::table('v2_external_subscription_plan')->where('plan_id', $plan->id)->delete();
            DB::table('v2_external_subscription')->whereIn('id', $ids)->increment('revision');
            return response(['data' => $plan->delete()]);
        });
    }

    public function update(PlanUpdate $request)
    {
        $updateData = $request->only([
            'show',
            'renew'
        ]);

        $plan = Plan::find($request->input('id'));
        if (!$plan) {
            abort(500, '该订阅不存在');
        }

        try {
            $plan->update($updateData);
        } catch (\Exception $e) {
            abort(500, '保存失败');
        }

        return response([
            'data' => true
        ]);
    }

    public function sort(PlanSort $request)
    {
        DB::beginTransaction();
        foreach ($request->input('plan_ids') as $k => $v) {
            if (!Plan::find($v)->update(['sort' => $k + 1])) {
                DB::rollBack();
                abort(500, '保存失败');
            }
        }
        DB::commit();
        return response([
            'data' => true
        ]);
    }
}
