<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddExternalSubscriptionFilters extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('v2_external_subscription', 'filter_keywords')) {
            Schema::table('v2_external_subscription', fn(Blueprint $t) => $t->text('filter_keywords')->nullable());
        }
    }

    public function down()
    {
        if (Schema::hasColumn('v2_external_subscription', 'filter_keywords')) {
            Schema::table('v2_external_subscription', fn(Blueprint $t) => $t->dropColumn('filter_keywords'));
        }
    }
}
