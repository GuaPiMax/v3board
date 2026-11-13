<?php
namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Models\User;
use App\Models\Order;
use App\Models\Plan;
use App\Services\AuthService;
use App\Services\OrderService;

class FrameworkUpgradeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('v2_user', function(Blueprint $t) {
            $t->increments('id');$t->string('email');$t->string('password');$t->string('uuid');$t->string('token');
            $t->string('password_algo')->nullable();$t->string('password_salt')->nullable();
            foreach(['is_admin','is_staff','banned','u','d','transfer_enable','balance','group_id','plan_id','device_limit'] as $key) $t->bigInteger($key)->default(0);
            $t->bigInteger('expired_at')->nullable();$t->integer('speed_limit')->nullable();$t->bigInteger('created_at');$t->bigInteger('updated_at');
        });
    }

    public function test_login_and_real_admin_authentication(): void
    {
        $user=User::create(['email'=>'admin@example.com','password'=>password_hash('test-password',PASSWORD_DEFAULT),
            'uuid'=>'11111111-2222-4333-8444-555555555555','token'=>'test-sub-token','is_admin'=>1]);
        $response=$this->postJson('/api/v1/passport/auth/login',['email'=>$user->email,'password'=>'test-password']);
        $response->assertOk()->assertJsonPath('data.is_admin',1);
        $token=$response->json('data.auth_data');
        $this->assertSame($user->id,AuthService::decryptAuthData($token)['id']);
        $this->assertFalse(AuthService::decryptAuthData(['not-a-string']));
        $this->assertFalse(AuthService::decryptAuthData('invalid-jwt'));
        $this->postJson('/api/v1/passport/auth/login',['email'=>$user->email,'password'=>'wrong-password'])->assertStatus(500);
    }

    public function test_paid_order_opens_current_plan_without_double_grant(): void
    {
        Schema::create('v2_plan',function(Blueprint $t){$t->increments('id');$t->integer('transfer_enable');$t->integer('group_id');$t->integer('device_limit')->nullable();$t->integer('speed_limit')->nullable();$t->bigInteger('created_at');$t->bigInteger('updated_at');});
        Schema::create('v2_order',function(Blueprint $t){$t->increments('id');foreach(['user_id','plan_id','type','status','total_amount','refund_amount'] as $key)$t->integer($key)->default(0);$t->string('period');$t->string('trade_no');$t->text('surplus_order_ids')->nullable();$t->string('callback_no')->nullable();$t->bigInteger('paid_at')->nullable();$t->bigInteger('created_at');$t->bigInteger('updated_at');});
        $user=User::create(['email'=>'buyer@example.com','password'=>'unused','uuid'=>'uuid','token'=>'token','expired_at'=>null]);
        $plan=Plan::create(['transfer_enable'=>10,'group_id'=>2,'device_limit'=>2]);
        $order=Order::create(['user_id'=>$user->id,'plan_id'=>$plan->id,'type'=>1,'status'=>0,'period'=>'month_price','trade_no'=>'test-trade','total_amount'=>100]);
        $paid=(new OrderService($order))->paid('test-callback');
        if (!$paid) (new \App\Jobs\OrderHandleJob($order->trade_no))->handle();
        $this->assertTrue($paid);
        $user->refresh();$expiry=$user->expired_at;
        $this->assertSame($plan->id,$user->plan_id);$this->assertSame(10*1073741824,$user->transfer_enable);
        $this->assertGreaterThan(time(),$expiry);$this->assertSame(3,$order->fresh()->status);
        $this->assertTrue((new OrderService($order->fresh()))->paid('duplicate'));
        $this->assertSame($expiry,$user->fresh()->expired_at);
    }

    public function test_horizon_uses_panel_admin_tokens_in_production(): void
    {
        $this->app->detectEnvironment(fn()=>'production');
        // Keep the real route and both auth middleware; replace only Redis-backed statistics.
        $this->app->instance(\Laravel\Horizon\Http\Controllers\DashboardStatsController::class,
            new class extends \Laravel\Horizon\Http\Controllers\DashboardStatsController {
                public function index(){return ['status'=>'inactive'];}
            });
        $admin=User::create(['email'=>'monitor-admin@example.com','password'=>'unused','uuid'=>'admin-uuid','token'=>'sub-admin','is_admin'=>1]);
        $member=User::create(['email'=>'monitor-member@example.com','password'=>'unused','uuid'=>'member-uuid','token'=>'sub-member','is_admin'=>0]);
        $request=\Illuminate\Http\Request::create('/');
        $adminToken=(new AuthService($admin))->generateAuthData($request)['auth_data'];
        $memberToken=(new AuthService($member))->generateAuthData($request)['auth_data'];
        $this->getJson('/monitor/api/stats',['authorization'=>$adminToken])->assertOk()->assertJsonPath('status','inactive');
        $this->getJson('/monitor/api/stats',['authorization'=>$memberToken])->assertForbidden();
        $this->getJson('/monitor/api/stats',['authorization'=>'invalid'])->assertForbidden();
        $this->getJson('/monitor/api/stats')->assertForbidden();
        $forged=\Illuminate\Http\Request::create('/monitor/api/stats','GET',['user'=>['is_admin'=>1]]);
        $this->assertFalse(\Laravel\Horizon\Horizon::check($forged));
    }

    public function test_mail_uses_symfony_transport_and_queue_names_are_preserved(): void
    {
        config(['mail.driver'=>'array']);Mail::purge();
        Mail::raw('upgrade smoke test',function($message){$message->to('recipient@example.com')->subject('Upgrade test');});
        $transport=Mail::mailer()->getSymfonyTransport();
        $this->assertInstanceOf(\Illuminate\Mail\Transport\ArrayTransport::class,$transport);
        $this->assertCount(1,$transport->messages());
        config(['mail.driver'=>'smtp','mail.host'=>'localhost','mail.port'=>465,'mail.scheme'=>'smtps']);Mail::purge();
        $this->assertInstanceOf(\Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport::class,Mail::mailer()->getSymfonyTransport());
        $this->assertSame('order_handle',(new \App\Jobs\OrderHandleJob('trade'))->queue);
        $this->assertSame('send_email',(new \App\Jobs\SendEmailJob([]))->queue);
        $this->assertNotEmpty(config('horizon.environments.*.V2board.queue'));
    }

    public function test_scheduler_and_database_log_redaction(): void
    {
        $events=app(\Illuminate\Console\Scheduling\Schedule::class)->events();
        $external=array_values(array_filter($events,fn($e)=>str_contains($e->command??'','external-subscriptions:sync')));
        $this->assertCount(1,$external);$this->assertSame('*/30 * * * *',$external[0]->expression);
        Schema::create('v2_log',function(Blueprint $t){$t->increments('id');foreach(['title','level','host','uri','method','ip','data','context'] as $key)$t->text($key)->nullable();$t->bigInteger('created_at');$t->bigInteger('updated_at');});
        $request=\Illuminate\Http\Request::create('/test?token=must-not-log','POST',['password'=>'must-not-log']);app()->instance('request',$request);
        $logger=new \Monolog\Logger('upgrade');$logger->pushHandler(new \App\Logging\MysqlLoggerHandler());
        $logger->error('secret-in-exception',['exception'=>new \RuntimeException('must-not-log')]);
        $row=DB::table('v2_log')->first();$this->assertNotNull($row);
        $this->assertStringNotContainsString('must-not-log',json_encode($row));
        $this->assertSame('/test',$row->uri);
    }
}
