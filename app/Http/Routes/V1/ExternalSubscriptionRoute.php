<?php
namespace App\Http\Routes\V1;
use Illuminate\Contracts\Routing\Registrar;

class ExternalSubscriptionRoute
{
    public function map(Registrar $router)
    {
        $path = config('v2board.secure_path', config('v2board.frontend_admin_path', hash('crc32b', config('app.key'))));
        $router->group(['prefix' => $path . '/external-subscription', 'middleware' => ['admin', 'throttle:60,1']], function ($router) {
            $router->get('fetch', 'V1\\Admin\\ExternalSubscriptionController@fetch');
            $router->post('save', 'V1\\Admin\\ExternalSubscriptionController@save');
            $router->post('drop', 'V1\\Admin\\ExternalSubscriptionController@drop');
            $router->post('sync', 'V1\\Admin\\ExternalSubscriptionController@sync')->middleware('throttle:6,1');
        });
    }
}
