<?php
/** Standalone isolated regression suite: php tests/external-subscriptions.php */
error_reporting(E_ALL & ~E_DEPRECATED);
putenv('APP_ENV=testing'); putenv('CACHE_DRIVER=array'); putenv('DB_CONNECTION=sqlite'); putenv('DB_DATABASE=:memory:');
putenv('APP_KEY=base64:' . base64_encode(str_repeat('test-key', 4)));
putenv('APP_CONFIG_CACHE=bootstrap/cache/external-test-config.php');
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
error_reporting(E_ALL & ~E_DEPRECATED);
set_exception_handler(function ($e) { fwrite(STDERR, (string)$e . "\n"); exit(1); });
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:', 'cache.default' => 'array',
    'v2board.secure_path' => 'test-admin', 'v2board.app_url' => 'https://panel.example.com', 'v2board.subscribe_url' => 'https://panel.example.com']);
set_error_handler(function ($severity, $message, $file, $line) {
    if (error_reporting() & $severity) throw new ErrorException($message, 0, $severity, $file, $line);
});
use App\Services\ExternalSubscription\Parser;
use App\Services\ExternalSubscription\Fetcher;
use App\Services\ExternalSubscription\Output;
use App\Services\ExternalSubscription\Subscriptions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Database\Schema\Blueprint;

$count = 0;
function check($condition, $message) { global $count; if (!$condition) throw new RuntimeException($message); $count++; }
$uuid = '11111111-2222-4333-8444-555555555555';
$uris = [
    'ss://' . base64_encode('aes-128-gcm:external-ss') . '@node.example.com:443#SS',
    'vmess://' . base64_encode(json_encode(['add'=>'node.example.com','port'=>443,'id'=>$uuid,'aid'=>0,'net'=>'ws','path'=>'/socket','host'=>'cdn.example.com','tls'=>'tls','sni'=>'tls.example.com','ps'=>'VMess'])),
    'vless://' . $uuid . '@node.example.com:443?security=reality&pbk=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&sid=abcd&flow=xtls-rprx-vision#VLESS',
    'trojan://external-trojan@node.example.com:443?sni=tls.example.com#Trojan',
    'hysteria2://external-hy@node.example.com:443?sni=tls.example.com&obfs=salamander&obfs-password=obfs-secret#HY2',
    'tuic://' . $uuid . ':different-password@node.example.com:443?sni=tls.example.com#TUIC',
    'anytls://external-anytls@node.example.com:443?sni=tls.example.com#AnyTLS',
];
$parser = new Parser(); $parsed = $parser->parse(implode("\n", $uris));
check(count($parsed['nodes']) === 7 && !$parsed['errors'], 'Seven protocol parsing');
check($parser->parse(base64_encode(implode("\n", $uris))) === $parsed, 'Base64 subscription');
check($parser->parse("\xEF\xBB\xBF".implode("\n",$uris))===$parsed,'UTF-8 BOM subscription');
check($parser->parse(base64_encode("\xEF\xBB\xBF".implode("\n",$uris)))===$parsed,'Base64 subscription with BOM');
check($parser->parse('trojan://secret@node.example.com:443#%FF')['nodes']===[],'Invalid UTF-8 rejected per node');
check($parser->parse('ss://2022-blake3-aes-128-gcm:bad-key@node.example.com:443')['nodes']===[],'Invalid SS2022 key rejected');
check(count($parser->parse('ss://2022-blake3-aes-128-gcm:'.rawurlencode(base64_encode(str_repeat('k',16))).'@node.example.com:443')['nodes'])===1,'Valid SS2022 key accepted');
check($parser->parse('vless://'.$uuid.'@node.example.com:443?security=reality&pbk=invalid')['nodes']===[],'Invalid Reality key rejected');
check(count($parser->parse($uris[0] . "\n" . $uris[0])['nodes']) === 1, 'Exact duplicates');
check($parser->parse('ss://bad')['nodes'] === [], 'Invalid SS');
check($parser->parse('trojan://secret@node.example.com:443?plugin=unexpected')['nodes'] === [], 'Unknown options rejected');
check($parser->parse('trojan://secret@node.example.com:443?sni[]=bad')['nodes'] === [], 'Array query rejected');
check($parser->parse('trojan://secret@node.example.com:443#%0Ainjection')['nodes'] === [], 'Newline injection rejected');
foreach (['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1','224.0.0.1'] as $ip) check(!Fetcher::publicIp($ip), 'Reject non-public IP ' . $ip);
check(Fetcher::publicIp('1.1.1.1'), 'Accept public IP');
foreach (['file:///etc/passwd','https://user:password@example.com/','http://example.com/#fragment',"https://example.com/\r\nX: bad"] as $url) {
    try { Fetcher::validateUrl($url); check(false, 'Unsafe URL accepted'); } catch (RuntimeException $e) { check(true, 'Unsafe URL rejected'); }
}
$user = new App\Models\User(['id'=>1,'plan_id'=>1,'banned'=>0,'expired_at'=>time()+3600,'transfer_enable'=>1000,'u'=>100,'d'=>200,'uuid'=>'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee','token'=>'local-test','speed_limit'=>null]);
check(Subscriptions::eligible($user), 'Available user');
foreach (['banned'=>1,'expired_at'=>time(),'transfer_enable'=>300,'plan_id'=>null] as $key=>$value) {
    $other = clone $user; $other[$key]=$value; check(!Subscriptions::eligible($other), 'Permission ' . $key);
}
$native = $parsed['nodes'][0]; unset($native['external']);
$native['id']=1;
check(Output::filter([$native], App\Protocols\Clash::class) === [$native], 'Native nodes preserved');
$nodes=$parsed['nodes']; foreach ($nodes as $i=>&$n) $n['id']=-($i+1); unset($n);
foreach (glob(__DIR__.'/../app/Protocols/*.php') as $file) {
    $name=basename($file,'.php'); if ($name==='NextinEncrypted') continue;
    $_SERVER['HTTP_HOST']='panel.example.com';
    $class='App\\Protocols\\'.$name;
    $result=(new $class($user,$nodes))->handle();
    $text=$result instanceof Symfony\Component\HttpFoundation\Response ? $result->getContent() : $result;
    check(is_string($text) && $text!=='', 'Render '.$name);
    $decoded=base64_decode($text,true); $inspect=$decoded!==false?$decoded:$text;
    check(strpos($inspect,$user['uuid'])===false, 'No native UUID leaked into external nodes '.$name);
}
foreach ([App\Protocols\Singbox\Singbox::class,App\Protocols\Singbox\SingboxOld::class] as $class) {
    $result=(new $class($user,$nodes))->handle();
    $json=json_decode($result->getContent(),true,64,JSON_THROW_ON_ERROR);
    $tuic=array_values(array_filter($json['outbounds'],fn($n)=>($n['type']??'')==='tuic'))[0];
    check($tuic['uuid']===$uuid && $tuic['password']==='different-password','TUIC credentials '.$class);
}
$tuic=App\Protocols\ClashMeta::buildTuic($user['uuid'],$nodes[5]);
check($tuic['uuid']===$uuid && $tuic['password']==='different-password','Mihomo TUIC credentials');
$ss2022=$nodes[0];$ss2022['cipher']='2022-blake3-aes-128-gcm';$ss2022['external_credential']='provider-key';
check(App\Protocols\ClashMeta::buildShadowsocks($user['uuid'],$ss2022)['password']==='provider-key','SS2022 no derivation');
check(App\Protocols\ClashMeta::buildShadowsocks($user['uuid'],array_diff_key($nodes[0],array_flip(['external','external_credential','external_uri'])))['password']===$user['uuid'],'Native credential unchanged');
check(strpos(Output::uri(array_merge($nodes[3],['host'=>'rewritten.example.com'])),'@rewritten.example.com:443')!==false,'URI host rewrite');
$alpn=$parser->parse('trojan://secret@node.example.com:443?alpn=h2,http%2F1.1')['nodes'][0];
check(App\Protocols\ClashMeta::buildTrojan('native',$alpn)['alpn']===['h2','http/1.1'],'Provider ALPN preserved');
check(Output::filter([$alpn],App\Protocols\Surge::class)===[],'Unsupported line ALPN skipped');
$hostile=$nodes[3];$hostile['name']='node, injected=true';
check(Output::filter([$hostile],App\Protocols\Surge::class)===[],'Line config delimiter injection blocked');
foreach (['http://127.0.0.1/','http://169.254.169.254/latest/meta-data/','http://[::1]/'] as $url) {
    try {(new Fetcher())->fetch($url);check(false,'Private fetch permitted');} catch(RuntimeException $e){check($e->getMessage()==='禁止访问内网或保留地址','Fetch rejects private address before connection');}
}

require __DIR__.'/../database/migrations/2026_11_13_000001_create_external_subscriptions.php';
(new CreateExternalSubscriptions())->up(); (new CreateExternalSubscriptions())->up();
require __DIR__.'/../database/migrations/2026_11_13_000002_add_external_subscription_node_prefix.php';
(new AddExternalSubscriptionNodePrefix())->up(); (new AddExternalSubscriptionNodePrefix())->up();
require __DIR__.'/../database/migrations/2026_11_13_000003_add_external_subscription_filters.php';
(new AddExternalSubscriptionFilters())->up(); (new AddExternalSubscriptionFilters())->up();
Schema::create('v2_plan',function(Blueprint $t){$t->increments('id');$t->string('name');});
DB::table('v2_plan')->insert([['id'=>1,'name'=>'A'],['id'=>2,'name'=>'B']]);
$sourceId=DB::table('v2_external_subscription')->insertGetId(['name'=>'Provider','url'=>Crypt::encryptString('https://example.com/secret'), 'updated_at'=>time()]);
foreach([1,2] as $planId) DB::table('v2_external_subscription_plan')->insert(['subscription_id'=>$sourceId,'plan_id'=>$planId]);
$app->instance(Fetcher::class,new class(implode("\n",$uris)) extends Fetcher {private $body;public function __construct($body){$this->body=$body;}public function fetch(string $url):string{return $this->body;}});
$service=new Subscriptions(); check($service->sync($sourceId),'Sync success');
check(count($service->nodes($user))===7,'Plan A gets nodes');
$original=$service->nodes($user);
check($original[0]['name']===$nodes[0]['name'],'Empty prefix keeps original node name');
$snapshot=DB::table('v2_external_subscription')->where('id',$sourceId)->value('snapshot');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['node_prefix'=>'备用 ']);
$prefixed=$service->nodes($user);
check($prefixed[0]['name']==='备用 '.$nodes[0]['name'],'Prefix directly prepends and preserves spaces');
check($service->nodes($user)[0]['name']===$prefixed[0]['name'],'Prefix is not applied twice');
check($original[0]['cache_key']!==$prefixed[0]['cache_key'],'Prefix invalidates metadata cache key immediately');
check(DB::table('v2_external_subscription')->where('id',$sourceId)->value('snapshot')===$snapshot,'Prefix leaves encrypted snapshot untouched');
check($prefixed[0]['external_credential']===$original[0]['external_credential'],'Prefix retains node credentials');
check(str_contains(urldecode(Output::uri($prefixed[0])), '备用 '.$nodes[0]['name']),'URI output includes prefix');
$vmess=json_decode(base64_decode(substr(trim(Output::uri($prefixed[1])),8)),true);
check($vmess['ps']==='备用 '.$nodes[1]['name'],'VMess JSON remark includes prefix');
$rendered=(new App\Protocols\ClashMeta($user,$prefixed))->handle();
$meta=Symfony\Component\Yaml\Yaml::parse($rendered instanceof Symfony\Component\HttpFoundation\Response ? $rendered->getContent() : $rendered);
check($meta['proxies'][0]['name']==='备用 '.$nodes[0]['name'],'Clash YAML includes prefix');
$rendered=(new App\Protocols\Singbox\Singbox($user,$prefixed))->handle();
$singbox=json_decode($rendered instanceof Symfony\Component\HttpFoundation\Response ? $rendered->getContent() : $rendered,true);
check(in_array('备用 '.$nodes[0]['name'],array_column($singbox['outbounds'],'tag'),true),'Sing-box JSON includes prefix');
$secondId=DB::table('v2_external_subscription')->insertGetId(['name'=>'Other provider','url'=>Crypt::encryptString('https://example.com/other'),'snapshot'=>$snapshot,'synced_at'=>time(),'updated_at'=>time(),'node_prefix'=>'专线']);
DB::table('v2_external_subscription_plan')->insert(['subscription_id'=>$secondId,'plan_id'=>1]);
check($service->nodes($user)[7]['name']==='专线'.$nodes[0]['name'],'Each source has its own prefix');
DB::table('v2_external_subscription')->where('id',$secondId)->update(['node_prefix'=>'备用 ']);
$duplicates=$service->nodes($user);
check($duplicates[7]['name']===$prefixed[0]['name'].' (2)','Same prefix and name get a collision suffix');
check(Output::uniqueNames($duplicates)===$duplicates,'Collision naming is idempotent');
$nativeCollision=$native;$nativeCollision['name']=$prefixed[0]['name'];
$mixed=Output::filter(array_merge([$nativeCollision],$duplicates), App\Protocols\ClashMeta::class);
check($mixed[0]['name']===$nativeCollision['name'] && $mixed[1]['name']===$prefixed[0]['name'].' (2)','Native name retained on collision');
check(count(array_unique(array_column($mixed,'name')))===count($mixed),'All mixed output names remain unique');
DB::table('v2_external_subscription_plan')->where('subscription_id',$secondId)->delete();
DB::table('v2_external_subscription')->where('id',$secondId)->delete();
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['node_prefix'=>'']);
check($service->nodes($user)[0]['name']===$nodes[0]['name'],'Clearing prefix restores original name without syncing');
$unfiltered=$service->nodes($user);
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['filter_keywords'=>json_encode(['vMeSs','Trojan'])]);
$filtered=$service->nodes($user);
check(count($filtered)===5 && !in_array('VMess',array_column($filtered,'name'),true) && !in_array('Trojan',array_column($filtered,'name'),true),'Any keyword excludes matches case-insensitively');
check($filtered[1]['id']===$unfiltered[2]['id'],'Filtering preserves original IDs and node order');
check(count($service->metadata($user))===5,'Web node list uses the same filtering');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['node_prefix'=>'VMess备用','filter_keywords'=>json_encode(['VMess'])]);
check(count($service->nodes($user))===6,'Prefix does not participate in original-name matching');
check(str_starts_with($service->nodes($user)[0]['name'],'VMess备用'),'Filtering retains configured prefix on allowed nodes');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['node_prefix'=>'','filter_keywords'=>json_encode(['ss','trojan','hy2','tuic','anytls'])]);
check(!$service->nodes($user) && !$service->metadata($user),'All matched nodes disappear without falling back to unfiltered cache');
check(DB::table('v2_external_subscription')->where('id',$sourceId)->value('snapshot')===$snapshot,'Keyword changes do not rewrite cached nodes');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['filter_keywords'=>'[]']);
check($service->nodes($user)===$unfiltered,'Clearing keywords immediately restores nodes without fetching');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['filter_keywords'=>'{invalid json']);
check(!$service->nodes($user),'Corrupt filter rules fail closed for their source');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['filter_keywords'=>null]);
check(count($service->nodes($user))===7,'Legacy null filter means no exclusion');
$chineseNodes=array_map(fn($name)=>array_merge($nodes[0],['name'=>$name]),['香港A','日本A','HxK','H.K']);
$chineseId=DB::table('v2_external_subscription')->insertGetId(['name'=>'Chinese fixture','url'=>Crypt::encryptString('https://example.com/chinese'),'snapshot'=>Crypt::encryptString(json_encode($chineseNodes)),'synced_at'=>time(),'updated_at'=>time(),'filter_keywords'=>json_encode(['香港','H.K'])]);
DB::table('v2_external_subscription_plan')->insert(['subscription_id'=>$chineseId,'plan_id'=>1]);
$chineseResult=$service->nodes($user);
check(count($chineseResult)===9 && $chineseResult[7]['name']==='日本A' && $chineseResult[8]['name']==='HxK','Chinese filters are substring matches and punctuation is literal');
check(array_slice($chineseResult,0,7)===$unfiltered,'Filtering one source leaves other sources unchanged');
DB::table('v2_external_subscription_plan')->where('subscription_id',$chineseId)->delete();
DB::table('v2_external_subscription')->where('id',$chineseId)->delete();
$other=clone $user;$other->plan_id=2;check(count($service->nodes($other))===7,'Plan B shared source');
$other->plan_id=3;check(!$service->nodes($other),'Unbound plan isolated');
$metadata=json_encode($service->metadata($user));check(strpos($metadata,'external-trojan')===false && strpos($metadata,'node.example.com')===false && strpos($metadata,'external_uri')===false,'Metadata excludes secrets');
$app->instance(Fetcher::class,new class extends Fetcher {public function fetch(string $url):string{throw new RuntimeException('请求失败或超时');}});
check(!$service->sync($sourceId) && count($service->nodes($user))===7,'Failed sync retains valid cache');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['synced_at'=>time()-86400]);check(!$service->nodes($user),'Expired cache excluded');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['synced_at'=>time(),'enabled'=>0]);check(!$service->nodes($user),'Disabled source excluded');
DB::table('v2_external_subscription')->where('id',$sourceId)->update(['enabled'=>1]);
$before=DB::table('v2_external_subscription')->where('id',$sourceId)->value('snapshot');
$app->instance(Fetcher::class,new class($sourceId,$uris[0]) extends Fetcher {private $id;private $uri;public function __construct($id,$uri){$this->id=$id;$this->uri=$uri;}public function fetch(string $url):string{DB::table('v2_external_subscription')->where('id',$this->id)->increment('revision');return $this->uri;}});
check(!$service->sync($sourceId),'Stale in-flight sync discarded');
check(DB::table('v2_external_subscription')->where('id',$sourceId)->value('snapshot')===$before,'Concurrent edit snapshot preserved');
// Multiple large snapshots must be loaded in bounded batches and stop at the response limit.
$batch=[];for($i=0;$i<1000;$i++)$batch[]=array_merge($nodes[0],['name'=>'Stress '.$i]);
$encrypted=Crypt::encryptString(json_encode($batch,JSON_THROW_ON_ERROR));$stressIds=[];
for($i=0;$i<5;$i++){
    $id=DB::table('v2_external_subscription')->insertGetId(['name'=>'Stress','url'=>Crypt::encryptString('https://example.com/fixture'),'snapshot'=>$encrypted,'synced_at'=>time(),'updated_at'=>time()]);
    $stressIds[]=$id;DB::table('v2_external_subscription_plan')->insert(['subscription_id'=>$id,'plan_id'=>1]);
}
DB::enableQueryLog();DB::flushQueryLog();$largeResult=$service->nodes($user);$queryLog=DB::getQueryLog();DB::disableQueryLog();
$sourceQueries=array_filter($queryLog,fn($q)=>str_contains($q['query'],'"v2_external_subscription" as "s"'));
check(count($largeResult)===3000,'Large response node limit');
check(count($sourceQueries)===4,'Snapshot batching stops before loading unused sources');
DB::table('v2_external_subscription_plan')->whereIn('subscription_id',$stressIds)->delete();
DB::table('v2_external_subscription')->whereIn('id',$stressIds)->delete();unset($largeResult,$encrypted,$batch);
// Real registered API routes: authentication, authorization, binding validation, edits and deletion.
$routePath = null;
foreach ($app['router']->getRoutes() as $route) {
    if (strpos($route->getActionName(), 'ExternalSubscriptionController@fetch') !== false) $routePath = '/' . $route->uri();
}
check($routePath !== null, 'Extension route auto discovery');
Schema::create('v2_user', function(Blueprint $t){$t->increments('id');$t->string('email');$t->integer('is_admin');$t->integer('is_staff')->default(0);$t->integer('banned')->default(0);$t->string('token');});
DB::table('v2_user')->insert([['id'=>1,'email'=>'admin@example.com','is_admin'=>1,'token'=>'admin-sub'],['id'=>2,'email'=>'member@example.com','is_admin'=>0,'token'=>'member-sub']]);
$adminToken=(new App\Services\AuthService(App\Models\User::find(1)))->generateAuthData(Illuminate\Http\Request::create('/'))['auth_data'];
$memberToken=(new App\Services\AuthService(App\Models\User::find(2)))->generateAuthData(Illuminate\Http\Request::create('/'))['auth_data'];
function api($method, $path, $token = null, $data = []) {
    global $app;
    $request=Illuminate\Http\Request::create($path,$method,$data,[],[],['HTTP_ACCEPT'=>'application/json','HTTP_ORIGIN'=>'http://localhost']);
    if ($token) $request->headers->set('authorization',$token);
    return $app->make(Illuminate\Contracts\Http\Kernel::class)->handle($request);
}
check(api('GET',$routePath)->getStatusCode()===403,'Anonymous API denied');
check(api('GET',$routePath,$memberToken)->getStatusCode()===403,'Ordinary user API denied');
$response=api('GET',$routePath,$adminToken);
check($response->getStatusCode()===200 && strpos($response->getContent(),'secret')===false,'Admin fetch without credentials');
$prefix=substr($routePath,0,-5);
$data=['name'=>'New','url'=>'https://example.com/sub?token=private','enabled'=>true,'plan_ids'=>[1,2]];
$response=api('POST',$prefix.'save',$adminToken,$data);
check($response->getStatusCode()===200,'Create source: '.$response->getContent());
$id=json_decode($response->getContent(),true)['data']['id'];
check(DB::table('v2_external_subscription_plan')->where('subscription_id',$id)->count()===2,'Multi-plan binding persisted');
check(strpos(DB::table('v2_external_subscription')->where('id',$id)->value('url'),'private')===false,'URL encrypted at rest');
$data['id']=$id;$data['revision']=1;$data['plan_ids']=[2];$data['url']='';
check(api('POST',$prefix.'save',$adminToken,$data)->getStatusCode()===200,'Edit retains URL');
check(DB::table('v2_external_subscription_plan')->where('subscription_id',$id)->count()===1,'Rebinding removes old plan');
check(api('POST',$prefix.'save',$adminToken,$data)->getStatusCode()===409,'Stale update rejected');
$data['revision']=2;$data['plan_ids']=[999];
check(api('POST',$prefix.'save',$adminToken,$data)->getStatusCode()===422,'Nonexistent plan rejected');
check(api('POST',$prefix.'drop',$memberToken,['id'=>$id])->getStatusCode()===403,'Ordinary user cannot delete');
check(api('POST',$prefix.'drop',$adminToken,['id'=>$id])->getStatusCode()===200,'Admin delete');
check(DB::table('v2_external_subscription_plan')->where('subscription_id',$id)->count()===0,'Delete cleans bindings');
$adminPath=explode('/',trim($routePath,'/'))[2]; // Routes were registered before this fixture changes config.
$redirect=api('GET','/'.$adminPath.'/external-subscriptions');
check($redirect->getStatusCode()===302,'Legacy page redirects to main admin');
check($redirect->headers->get('Location')==='http://localhost/'.config('v2board.secure_path').'#/external-subscriptions','Legacy page retains configured admin path');
// Optional baseline comparison against the pre-change Git revision exported into _demo/baseline.
if (is_dir(__DIR__.'/../_demo/baseline')) {
    $nativeNodes=array_map(function($node){foreach(array_keys($node) as $key) if($key==='external'||strpos($key,'external_')===0) unset($node[$key]);$node+=['obfs'=>null];return $node;},$nodes);
    foreach (glob(__DIR__.'/../_demo/baseline/*.php') as $file) {
        require_once $file;$name=basename($file,'.php');
        $ns=in_array($name,['Singbox','SingboxOld'],true)?'App\\Protocols\\Singbox\\':'App\\Protocols\\';
        $class=$ns.$name;$baseline=$ns.'Baseline'.$name;
        $new=(new $class($user,$nativeNodes))->handle();$old=(new $baseline($user,$nativeNodes))->handle();
        $content=fn($r)=>$r instanceof Symfony\Component\HttpFoundation\Response?$r->getContent():$r;
        check($content($new)===$content($old),'Native output unchanged against Git baseline: '.$name);
    }
}
restore_error_handler(); echo "PASS: $count checks\n";
