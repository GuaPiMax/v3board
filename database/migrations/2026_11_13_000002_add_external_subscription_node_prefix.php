<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddExternalSubscriptionNodePrefix extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('v2_external_subscription', 'node_prefix')) {
            Schema::table('v2_external_subscription', function (Blueprint $t) {
                $t->string('node_prefix', 100)->default('');
            });
        }
    }

    public function down()
    {
        if (Schema::hasColumn('v2_external_subscription', 'node_prefix')) {
            Schema::table('v2_external_subscription', fn(Blueprint $t) => $t->dropColumn('node_prefix'));
        }
    }
}
