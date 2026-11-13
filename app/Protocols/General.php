<?php

namespace App\Protocols;

use App\Utils\Helper;

class General
{
    public $flag = 'general';
    private $servers;
    private $user;

    public function __construct($user, $servers)
    {
        $this->user = $user;
        $this->servers = \App\Services\ExternalSubscription\Output::filter($servers, static::class);
    }

    public function handle()
    {
        $uri = '';

        foreach ($this->servers as $server) {
            $uri .= Helper::buildUri($this->user['uuid'], $server);
        }
        return base64_encode($uri);
    }
}
