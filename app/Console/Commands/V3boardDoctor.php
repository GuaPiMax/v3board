<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class V3boardDoctor extends Command
{
    protected $signature = 'v3board:doctor';
    protected $description = '以站点运行用户检查部署环境（不输出密码、密钥或令牌）';

    public function handle()
    {
        $checks=[];
        $record=function($name,$ok,$detail='') use (&$checks){$checks[]=[$name,$ok?'OK':'FAIL',$detail];};
        $record('PHP 版本',PHP_VERSION_ID>=80400,PHP_VERSION);
        foreach(['curl','openssl','mbstring','fileinfo','pdo_mysql','redis'] as $ext)$record('扩展 '.$ext,extension_loaded($ext));
        if(PHP_OS_FAMILY!=='Windows')foreach(['pcntl','posix'] as $ext)$record('CLI 扩展 '.$ext,extension_loaded($ext));
        $record('.env 可读',is_file($this->laravel->environmentFilePath())&&is_readable($this->laravel->environmentFilePath()));
        if(is_readable($this->laravel->environmentFilePath())) {
            try {
                $env=\Dotenv\Dotenv::parse(file_get_contents($this->laravel->environmentFilePath()));
                if(!empty($env['APP_KEY']))$record('.env 与当前 APP_KEY 一致',hash_equals($env['APP_KEY'],(string)config('app.key')),'不显示密钥内容');
            }catch(\Throwable $e){$record('.env 格式',false,'检查文件格式，不要公开文件内容');}
        }
        $appKey=config('app.key');
        $decoded=is_string($appKey)&&str_starts_with($appKey,'base64:')?base64_decode(substr($appKey,7),true):$appKey;
        $record('APP_KEY 格式有效',is_string($decoded)&&\Illuminate\Encryption\Encrypter::supported($decoded,config('app.cipher','AES-256-CBC')));
        $record('生产调试关闭',!config('app.debug'));
        foreach(['config','config/theme','storage/logs','storage/framework/views','storage/framework/cache/data','storage/framework/sessions','bootstrap/cache'] as $dir) {
            $record($dir.' 可写',is_dir(base_path($dir))&&is_writable(base_path($dir)));
        }
        $viewPath=config('view.compiled');
        $record('实际编译视图目录可写',is_string($viewPath)&&is_dir($viewPath)&&is_writable($viewPath));
        $record('持久会话缓存',in_array(config('cache.default'),['redis','file','database','memcached'],true),(string)config('cache.default'));
        $key='doctor-probe-'.bin2hex(random_bytes(12));
        try {
            $ok=Cache::put($key,'ok',30)&&Cache::get($key)==='ok';
            $record('缓存读写',$ok);
            $lock=Cache::lock($key.'-lock',10);$acquired=$lock->get();
            $record('缓存锁',$acquired);if($acquired)$lock->release();
        }catch(\Throwable $e){$record('缓存连接',false,'检查 Redis/缓存配置');}
        finally {try{Cache::forget($key);}catch(\Throwable $ignore){}}
        try {
            DB::select('SELECT 1');$record('数据库连接',true);
            foreach(['v2_user','v2_plan','v2_external_subscription','v2_external_subscription_plan'] as $table)$record('数据表 '.$table,Schema::hasTable($table));
        }catch(\Throwable $e){$record('数据库连接/结构',false,'检查数据库连接与安装/迁移结果');}
        $routes=[];foreach(app('router')->getRoutes() as $route)$routes[$route->uri()]=true;
        $path=config('v2board.secure_path',config('v2board.frontend_admin_path',hash('crc32b',config('app.key'))));
        $record('后台页面路由',isset($routes[trim((string)$path,'/')]));
        $record('Horizon 监控路由',isset($routes[trim(config('horizon.path','monitor'),'/').'/api/stats']));
        $record('生产队列配置',!empty(config('horizon.environments.*.V2board.queue')));
        $this->table(['检查项目','结果','说明'],$checks);
        $this->line('此检查反映 CLI 配置与当前运行用户权限；不能代替 PHP-FPM、Nginx、Supervisor、定时任务和真实节点连通性验收。');
        return count(array_filter($checks,fn($row)=>$row[1]==='FAIL'))?self::FAILURE:self::SUCCESS;
    }
}
