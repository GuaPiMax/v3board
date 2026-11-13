<?php
namespace App\Logging;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Logger;
use Monolog\LogRecord;
use App\Models\Log as LogModel;

class MysqlLoggerHandler extends AbstractProcessingHandler
{
    public function __construct($level = Logger::DEBUG, bool $bubble = true)
    {
        parent::__construct($level, $bubble);
    }

    protected function write(LogRecord $entry): void
    {
        try{
            $record = $entry->toArray();
            $exception = $record['context']['exception'] ?? null;
            // Request bodies / query strings can contain passwords, auth tokens and subscription URLs.
            $record['request_data'] = [];
            $record['context'] = $exception instanceof \Throwable ? ['exception' => get_class($exception)] : [];
            $log = [
                'title' => $exception instanceof \Throwable ? 'Unhandled ' . get_class($exception) : $record['message'],
                'level' => $record['level_name'],
                'host' => $record['request_host'] ?? request()->getSchemeAndHttpHost(),
                'uri' => request()->getPathInfo(),
                'method' => $record['request_method'] ?? request()->getMethod(),
                'ip' => request()->getClientIp(),
                'data' => json_encode($record['request_data']) ,
                'context' => isset($record['context']) ? json_encode($record['context']) : '',
                'created_at' => $entry->datetime->getTimestamp(),
                'updated_at' => $entry->datetime->getTimestamp(),
            ];

            LogModel::insert(
                $log
            );
        }catch (\Throwable $e){
            // 只有在 APP_DEBUG 为 true 时才写入日志文件
            if (config('app.debug')) {
                Log::channel('daily')->error($e->getMessage().$e->getFile().$e->getTraceAsString());
            }
        }
    }
}
