<?php
namespace App\Services\ExternalSubscription;

use Illuminate\Support\Facades\DB;

/** Binding edits share the source row lock and revision with source-side edits. */
class PlanBindings
{
    public static function token(array $ids): string
    {
        $ids = array_map('intval', $ids);
        sort($ids);
        return hash('sha256', json_encode($ids));
    }

    public static function attachToPlans($plans): void
    {
        $bindings = DB::table('v2_external_subscription_plan')->get()->groupBy('plan_id');
        foreach ($plans as $plan) {
            $ids = isset($bindings[$plan->id]) ? $bindings[$plan->id]->pluck('subscription_id')->map(fn($id) => (int)$id)->all() : [];
            $plan->external_subscription_ids = $ids;
            $plan->external_binding_token = self::token($ids);
        }
    }

    /** Caller must run inside the plan save transaction; legacy clients omit ids. */
    public static function save(int $planId, array $ids, ?string $expected, bool $creating = false): void
    {
        // Same lock order for all plan edits, including overlapping source selections.
        $sources = DB::table('v2_external_subscription')->orderBy('id')->lockForUpdate()->pluck('id')->map(fn($id) => (int)$id)->all();
        $ids = array_map('intval', $ids);
        if (array_diff($ids, $sources)) abort(422, '第三方订阅来源已删除，请重新选择');
        $old = DB::table('v2_external_subscription_plan')->where('plan_id', $planId)->pluck('subscription_id')->all();
        if (!$creating && !hash_equals(self::token($old), $expected ?? '')) abort(409, '套餐绑定已被修改，请重新打开编辑后重试');
        DB::table('v2_external_subscription_plan')->where('plan_id', $planId)->delete();
        foreach ($ids as $id) DB::table('v2_external_subscription_plan')->insert(['subscription_id' => $id, 'plan_id' => $planId]);
        // Invalidates already-open source forms so they cannot overwrite plan-side changes.
        DB::table('v2_external_subscription')->whereIn('id', array_unique(array_merge($old, $ids)))->increment('revision');
    }
}
