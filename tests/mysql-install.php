<?php
/** Opt-in integration test against a disposable local MySQL/MariaDB server.
 * V3BOARD_TEST_MYSQL=1 V3BOARD_TEST_MYSQL_PASSWORD=... php tests/mysql-install.php
 * Creates and drops ONLY its own uniquely named v3board_test_* database.
 */
if (getenv('V3BOARD_TEST_MYSQL') !== '1') { fwrite(STDERR,"Set V3BOARD_TEST_MYSQL=1 to opt in to a disposable database test.\n");exit(1); }
require __DIR__.'/../vendor/autoload.php';
$root=dirname(__DIR__);$database='v3board_test_'.bin2hex(random_bytes(6));
$host=getenv('V3BOARD_TEST_MYSQL_HOST')?:'127.0.0.1';$port=getenv('V3BOARD_TEST_MYSQL_PORT')?:'33316';
$username=getenv('V3BOARD_TEST_MYSQL_USER')?:'root';$password=getenv('V3BOARD_TEST_MYSQL_PASSWORD')?:'';
$pdo=new PDO("mysql:host=$host;port=$port",$username,$password,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4");
$base=$root.'/_demo/'.$database;mkdir($base.'/bootstrap/cache',0777,true);
function copyFixture($from,$to){if(is_dir($from)){if(!is_dir($to))mkdir($to,0777,true);foreach(scandir($from) as $file)if($file!=='.'&&$file!=='..')copyFixture($from.'/'.$file,$to.'/'.$file);}else copy($from,$to);}
foreach(['config','database','routes'] as $dir)copyFixture($root.'/'.$dir,$base.'/'.$dir);
copyFixture($root.'/bootstrap/app.php',$base.'/bootstrap/app.php');copyFixture($root.'/.env.example',$base.'/.env.example');
copyFixture($root.'/composer.json',$base.'/composer.json');
mkdir($base.'/storage/framework/views',0777,true);mkdir($base.'/storage/logs',0777,true);
putenv('APP_ENV=testing');putenv('CACHE_DRIVER=array');putenv('QUEUE_CONNECTION=sync');putenv('LOG_CHANNEL=stderr');
putenv('APP_CONFIG_CACHE=bootstrap/cache/config.mysql-test.php');
putenv('APP_SERVICES_CACHE=bootstrap/cache/services.mysql-test.php');
putenv('APP_PACKAGES_CACHE=bootstrap/cache/packages.mysql-test.php');
$failed=false;
try {
    $app=require $root.'/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $app->setBasePath($base);
    $command=new class([$host,$port,$database,$username,'admin@example.com'],$password) extends App\Console\Commands\V2boardInstall {
        private $answers;private $password;
        public function __construct($answers,$password){parent::__construct();$this->answers=$answers;$this->password=$password;}
        public function ask($question,$default=null){return array_shift($this->answers);}
        public function secret($question,$fallback=true){return $this->password;}
    };
    $command->setLaravel($app);
    $kernel=$app->make(Illuminate\Contracts\Console\Kernel::class);
    $command->setApplication((new ReflectionMethod($kernel,'getArtisan'))->invoke($kernel));
    $buffer=new Symfony\Component\Console\Output\BufferedOutput();
    $command->setOutput(new Illuminate\Console\OutputStyle(new Symfony\Component\Console\Input\ArrayInput([]),$buffer));
    if($command->run(new Symfony\Component\Console\Input\ArrayInput([]),$buffer)!==0)throw new RuntimeException($buffer->fetch());
    if(!Illuminate\Support\Facades\Schema::hasTable('v2_external_subscription'))throw new RuntimeException('External table missing');
    $user=App\Models\User::where('email','admin@example.com')->firstOrFail();
    if(!$user->is_admin || !password_get_info($user->password)['algo'])throw new RuntimeException('Admin creation failed');
    $dotenv=Dotenv\Dotenv::parse(file_get_contents($base.'/.env'));
    if($dotenv['DB_PASSWORD']!==$password)throw new RuntimeException('Environment password was not preserved');
    if($command->run(new Symfony\Component\Console\Input\ArrayInput([]),$buffer)!==1)throw new RuntimeException('Reinstall must fail without changing existing data');
    if(App\Models\User::count()!==1)throw new RuntimeException('Reinstall changed data');
    // Exercise historical SQL updates; no Redis server is needed for the notification-only termination call.
    Illuminate\Support\Facades\DB::table('v2_stat_user')->insert(['user_id'=>$user->id,'server_rate'=>1,'u'=>1,'d'=>2,'record_type'=>'d','record_at'=>time(),'created_at'=>time(),'updated_at'=>time()]);
    $oldSource=Illuminate\Support\Facades\DB::table('v2_external_subscription')->insertGetId(['name'=>'Old source','url'=>'old-encrypted-url','snapshot'=>'old-encrypted-snapshot','updated_at'=>time()]);
    // Simulate an installed site from before the prefix column existed.
    Illuminate\Support\Facades\Schema::table('v2_external_subscription', fn($t)=>$t->dropColumn('node_prefix'));
    Illuminate\Support\Facades\DB::table('migrations')->where('migration','2026_11_13_000002_add_external_subscription_node_prefix')->delete();
    Illuminate\Support\Facades\Schema::table('v2_external_subscription', fn($t)=>$t->dropColumn('filter_keywords'));
    Illuminate\Support\Facades\DB::table('migrations')->where('migration','2026_11_13_000003_add_external_subscription_filters')->delete();
    Illuminate\Support\Facades\Artisan::shouldReceive('call')->with('config:cache')->andReturn(0);
    Illuminate\Support\Facades\Artisan::shouldReceive('call')->with('horizon:terminate')->andReturn(0);
    $update=new App\Console\Commands\V2boardUpdate();$update->setLaravel($app);$update->setApplication((new ReflectionMethod($kernel,'getArtisan'))->invoke($kernel));
    for($i=0;$i<2;$i++)if($update->run(new Symfony\Component\Console\Input\ArrayInput([]),$buffer)!==0)throw new RuntimeException('Update failed: '.$buffer->fetch());
    if(Illuminate\Support\Facades\DB::table('v2_stat_user')->count()!==1)throw new RuntimeException('Update removed current traffic statistics');
    $old=Illuminate\Support\Facades\DB::table('v2_external_subscription')->where('id',$oldSource)->first();
    if($old->node_prefix!=='' || $old->filter_keywords!==null || $old->snapshot!=='old-encrypted-snapshot')throw new RuntimeException('Source upgrade changed existing source data');
    // Exercise plan binding transactions against the actual MySQL-compatible schema.
    $plan=App\Models\Plan::create(['name'=>'Binding fixture','group_id'=>1,'transfer_enable'=>10]);
    $source=Illuminate\Support\Facades\DB::table('v2_external_subscription')->insertGetId(['name'=>'Fixture','url'=>Illuminate\Support\Facades\Crypt::encryptString('https://example.com/sub'),'updated_at'=>time()]);
    Illuminate\Support\Facades\DB::transaction(fn()=>App\Services\ExternalSubscription\PlanBindings::save($plan->id,[$source],null,true));
    $rows=collect([$plan]);App\Services\ExternalSubscription\PlanBindings::attachToPlans($rows);
    if($plan->external_subscription_ids!==[$source])throw new RuntimeException('MySQL binding fetch failed');
    $token=$plan->external_binding_token;
    Illuminate\Support\Facades\DB::transaction(fn()=>App\Services\ExternalSubscription\PlanBindings::save($plan->id,[],$token));
    try {
        Illuminate\Support\Facades\DB::transaction(fn()=>App\Services\ExternalSubscription\PlanBindings::save($plan->id,[$source],$token));
        throw new RuntimeException('MySQL stale binding edit accepted');
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        if($e->getStatusCode()!==409)throw $e;
    }
    if(Illuminate\Support\Facades\DB::table('v2_external_subscription_plan')->count()!==0)throw new RuntimeException('MySQL conflict rollback failed');
    echo 'PASS: MySQL-compatible fresh SQL import, external migration, admin creation, config cache, environment round-trip, reinstall refusal, repeated SQL update and binding conflict transactions ('.count(Illuminate\Support\Facades\DB::select('SHOW TABLES'))." tables)\n";
} catch (\Throwable $e) {
    fwrite(STDERR,(string)$e . "\n");$failed=true;
} finally {
    if(!preg_match('/^v3board_test_[a-f0-9]{12}$/D',$database))throw new RuntimeException('Unsafe test database name');
    $pdo->exec("DROP DATABASE `$database`");
}
if($failed)exit(1);
