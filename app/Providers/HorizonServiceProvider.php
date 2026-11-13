<?php
namespace App\Providers;

use App\Services\AuthService;
use Illuminate\Http\Request;
use Laravel\Horizon\Horizon;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    protected function authorization()
    {
        // Panel users authenticate via JWT/cache, not Laravel's session guard.
        // Revalidate the token rather than trusting a caller-provided user field.
        Horizon::auth(function (Request $request) {
            $token = $request->input('auth_data') ?? $request->header('authorization');
            $user = AuthService::decryptAuthData($token);
            return is_array($user) && !empty($user['is_admin']);
        });
    }
}
