<?php

namespace App\Services;

use App\Utils\CacheKey;
use App\Utils\Helper;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Request;

class AuthService
{
    private $user;

    public function __construct(User $user)
    {
        $this->user = $user;
    }

    public function generateAuthData(Request $request)
    {
        $guid = Helper::guid();
        $authData = JWT::encode([
            'id' => $this->user->id,
            'session' => $guid,
        ], config('app.key'), 'HS256');
        
        // 检查是否是 Telegram 登录（通过请求头判断）
        $isTelegramLogin = $request->header('X-Telegram-Login') === 'true';
        
        try {
            $saved = self::addSession($this->user->id, $guid, [
            'ip' => $isTelegramLogin ? 'Telegram登录' : ($request->ip() ?: '未知IP'),
            'login_at' => time(),
            'ua' => $request->userAgent() ?: ($isTelegramLogin ? 'Telegram Bot' : '未知设备'),
            'auth_data' => $authData
            ]);
        } catch (\Throwable $e) {
            abort(503, '暂时无法保存登录会话，请检查缓存服务');
        }
        if (!$saved) abort(503, '暂时无法保存登录会话，请检查缓存服务');
        return [
            'token' => $this->user->token,
            'is_admin' => $this->user->is_admin,
            'auth_data' => $authData
        ];
    }

    public static function decryptAuthData($jwt)
    {
        try {
            if (!is_string($jwt) || $jwt === '') {
                return false;
            }
            $data = (array)JWT::decode($jwt, new Key(config('app.key'), 'HS256'));
            if (!isset($data['id'], $data['session']) || !is_scalar($data['id']) || !is_string($data['session'])) return false;
        } catch (\Throwable $e) {
            return false;
        }
        try {
            if (!self::checkSession($data['id'], $data['session'])) return false;
            // Recheck revocation and current account privileges on every request.
            $user = User::select(['id', 'email', 'is_admin', 'is_staff', 'banned'])->find($data['id']);
            if (!$user || $user->banned) return false;
            $result = $user->toArray();
            unset($result['banned']);
            return $result;
        } catch (\Throwable $e) {
            // A transient DB/cache outage is not an invalid token; do not cause clients to erase it.
            abort(503, '登录验证服务暂时不可用，请稍后重试');
        }
    }

    private static function checkSession($userId, $session)
    {
        $sessions = Cache::get(CacheKey::get("USER_SESSIONS", $userId), []);
        return is_array($sessions) && array_key_exists($session, $sessions);
    }

    private static function addSession($userId, $guid, $meta)
    {
        $cacheKey = CacheKey::get("USER_SESSIONS", $userId);
        return Cache::lock('auth-sessions-' . $userId, 10)->block(3, function () use ($cacheKey, $guid, $meta) {
            $sessions = (array)Cache::get($cacheKey, []);
            $sessions[$guid] = $meta;
            return Cache::put($cacheKey, $sessions);
        });
    }

    public function getSessions()
    {
        return (array)Cache::get(CacheKey::get("USER_SESSIONS", $this->user->id), []);
    }

    public function removeSession($sessionId)
    {
        if (!is_string($sessionId) && !is_int($sessionId)) return false;
        $cacheKey = CacheKey::get("USER_SESSIONS", $this->user->id);
        return Cache::lock('auth-sessions-' . $this->user->id, 10)->block(3, function () use ($cacheKey, $sessionId) {
            $sessions = (array)Cache::get($cacheKey, []);
            if (isset($sessions[$sessionId]['auth_data'])) Cache::forget($sessions[$sessionId]['auth_data']);
            unset($sessions[$sessionId]);
            return Cache::put($cacheKey, $sessions);
        });
    }

    public function removeAllSession()
    {
        $cacheKey = CacheKey::get("USER_SESSIONS", $this->user->id);
        return Cache::lock('auth-sessions-' . $this->user->id, 10)->block(3, function () use ($cacheKey) {
            $sessions = (array)Cache::get($cacheKey, []);
            foreach ($sessions as $guid => $meta) {
                if (isset($meta['auth_data'])) {
                    Cache::forget($meta['auth_data']);
                }
            }
            return Cache::forget($cacheKey);
        });
    }
}
