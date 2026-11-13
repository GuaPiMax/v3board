<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateExternalSubscriptions extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('v2_external_subscription')) Schema::create('v2_external_subscription', function (Blueprint $t) {
            $t->increments('id'); $t->string('name', 100); $t->text('url');
            $t->boolean('enabled')->default(true); $t->unsignedInteger('revision')->default(1);
            $t->longText('snapshot')->nullable(); $t->unsignedInteger('synced_at')->nullable();
            $t->unsignedInteger('attempted_at')->nullable(); $t->text('status')->nullable();
            $t->unsignedInteger('node_count')->default(0); $t->unsignedInteger('updated_at');
        });
        if (!Schema::hasTable('v2_external_subscription_plan')) Schema::create('v2_external_subscription_plan', function (Blueprint $t) {
            $t->unsignedInteger('subscription_id'); $t->unsignedInteger('plan_id');
            $t->primary(['subscription_id','plan_id']); $t->index('plan_id');
        });
    }
    public function down()
    {
        Schema::dropIfExists('v2_external_subscription_plan');
        Schema::dropIfExists('v2_external_subscription');
    }
}
