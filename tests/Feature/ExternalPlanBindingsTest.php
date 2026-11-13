<?php
namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExternalPlanBindingsTest extends TestCase
{
    private string $prefix;
    private array $headers;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('v2_user', function (Blueprint $t) {
            $t->increments('id'); $t->string('email'); $t->string('password'); $t->string('uuid'); $t->string('token');
            $t->string('password_algo')->nullable(); $t->string('password_salt')->nullable();
            foreach (['is_admin','is_staff','banned','u','d','transfer_enable','balance','group_id','plan_id','device_limit'] as $key) $t->bigInteger($key)->default(0);
            $t->integer('speed_limit')->nullable();
            $t->bigInteger('expired_at')->nullable(); $t->bigInteger('created_at'); $t->bigInteger('updated_at');
        });
        Schema::create('v2_plan', function (Blueprint $t) {
            $t->increments('id'); $t->string('name'); $t->integer('sort')->nullable();
            $t->integer('group_id'); $t->integer('transfer_enable'); $t->integer('month_price')->nullable();
            $t->integer('device_limit')->nullable(); $t->integer('speed_limit')->nullable();
            $t->bigInteger('created_at'); $t->bigInteger('updated_at');
        });
        Schema::create('v2_order', function (Blueprint $t) { $t->increments('id'); $t->integer('plan_id'); });
        require_once database_path('migrations/2026_11_13_000001_create_external_subscriptions.php');
        (new \CreateExternalSubscriptions)->up();
        $user = User::create(['email'=>'binding-admin@example.com','password'=>'unused','uuid'=>'binding-test','token'=>'binding-sub','is_admin'=>1]);
        $this->headers = ['authorization'=>(new AuthService($user))->generateAuthData(\Illuminate\Http\Request::create('/'))['auth_data']];
        $path = config('v2board.secure_path', config('v2board.frontend_admin_path', hash('crc32b', config('app.key'))));
        $this->prefix = '/api/v1/'.$path;
        foreach ([1,2] as $id) DB::table('v2_external_subscription')->insert([
            'id'=>$id,'name'=>'Source '.$id,'url'=>\Illuminate\Support\Facades\Crypt::encryptString('https://example.com/sub'), 'updated_at'=>time()
        ]);
    }

    private function plan(array $extra = []): array
    {
        return array_merge(['name'=>'Plan','group_id'=>1,'transfer_enable'=>20,'month_price'=>1234,'device_limit'=>null,'speed_limit'=>null], $extra);
    }

    public function test_plan_and_source_binding_edits_are_atomic_and_bidirectional(): void
    {
        $this->postJson($this->prefix.'/plan/save', $this->plan(['external_subscription_ids'=>[1,2]]), $this->headers)->assertOk();
        $first = $this->getJson($this->prefix.'/plan/fetch', $this->headers)->assertOk()->json('data.0');
        $this->assertSame([1,2], $first['external_subscription_ids']);
        $this->assertSame(1234, $first['month_price']);
        $source = $this->getJson($this->prefix.'/external-subscription/fetch', $this->headers)->assertOk()->json('data.0');
        $this->assertSame([$first['id']], $source['plan_ids']);
        $this->postJson($this->prefix.'/plan/save', $this->plan(['id'=>$first['id'], 'external_subscription_ids'=>[], 'external_binding_token'=>$first['external_binding_token']]), $this->headers)->assertOk();
        $this->assertSame(0, DB::table('v2_external_subscription_plan')->count());
        $this->postJson($this->prefix.'/external-subscription/save', ['id'=>1,'revision'=>$source['revision'],'name'=>'Stale','enabled'=>true,'url'=>'','plan_ids'=>[$first['id']]], $this->headers)->assertStatus(409);
        // A stale plan save rolls back the plan fields as well as its bindings.
        $this->postJson($this->prefix.'/plan/save', $this->plan(['id'=>$first['id'],'name'=>'Stale plan','external_subscription_ids'=>[2],'external_binding_token'=>$first['external_binding_token']]), $this->headers)->assertStatus(409);
        $this->assertSame('Plan', DB::table('v2_plan')->value('name'));
        $this->assertSame(0, DB::table('v2_external_subscription_plan')->count());
        // Source-side changes are visible to the next plan fetch.
        $revision = DB::table('v2_external_subscription')->where('id',1)->value('revision');
        $this->postJson($this->prefix.'/external-subscription/save', ['id'=>1,'revision'=>$revision,'name'=>'Source 1','enabled'=>false,'url'=>'','plan_ids'=>[$first['id']]], $this->headers)->assertOk();
        $latest = $this->getJson($this->prefix.'/plan/fetch', $this->headers)->json('data.0');
        $this->assertSame([1], $latest['external_subscription_ids']);
        // Old clients omit the new fields and retain bindings.
        $this->postJson($this->prefix.'/plan/save', $this->plan(['id'=>$first['id'],'name'=>'Legacy edit']), $this->headers)->assertOk();
        $this->assertSame(1, DB::table('v2_external_subscription_plan')->count());
        $this->postJson($this->prefix.'/plan/save', $this->plan(['id'=>$first['id'],'external_subscription_ids'=>[999],'external_binding_token'=>$latest['external_binding_token']]), $this->headers)->assertStatus(422);
        $this->postJson($this->prefix.'/plan/drop', ['id'=>$first['id']], $this->headers)->assertOk();
        $this->assertSame(0, DB::table('v2_external_subscription_plan')->count());
    }

    public function test_old_page_redirects_to_main_admin_and_apis_still_require_auth(): void
    {
        $path = substr($this->prefix, strlen('/api/v1'));
        $this->get($path.'/external-subscriptions')->assertRedirect($path.'#/external-subscriptions');
        $this->postJson($this->prefix.'/plan/save', $this->plan(['external_subscription_ids'=>[1]]))->assertForbidden();
        $this->getJson($this->prefix.'/external-subscription/fetch')->assertForbidden();
    }
}
