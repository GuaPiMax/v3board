<?php
namespace App\Services\ExternalSubscription;

class Output
{
    /** A conservative capability gate, applied only to external nodes. */
    public static function filter(array $servers, string $class): array
    {
        $client = substr(strrchr($class, '\\'), 1);
        return array_values(array_filter($servers, function ($n) use ($client) {
            if (empty($n['external'])) return true;
            $uriClients = ['General','V2rayN','V2rayNG','v2RayTun','Passwall','SSRPlus','SagerNet','Shadowrocket'];
            if ($client === 'SagerNet' && $n['type'] === 'hysteria') return false;
            if (in_array($client, $uriClients, true)) return true;
            $line = in_array($client, ['Surge','Surfboard','Loon','QuantumultX'], true);
            // Existing line-based encoders do not quote arbitrary delimiters safely.
            if ($line) {
                foreach (['name','external_credential','external_password','server_name','obfs_password'] as $key) {
                    if (isset($n[$key]) && preg_match('/[,=;"\\\\\[\]]/', $n[$key])) return false;
                }
                if (strpos($n['host'], ':') !== false) return false;
                if ($n['network'] !== 'tcp' || $n['tls'] === 2 || !empty($n['external_alpn'])) return false;
            }
            if (in_array($client, ['Clash','Surfboard','Shadowsocks'], true) && $n['type'] === 'shadowsocks' && strpos($n['cipher'], '2022-') === 0) return false;
            if ($client === 'Shadowsocks') return $n['type'] === 'shadowsocks';
            if ($client === 'Surfboard' && $n['type'] === 'hysteria') return false;
            if ($client === 'Clash' && !in_array($n['type'], ['shadowsocks','vmess','trojan'], true)) return false;
            if ($client === 'SingboxOld' && $n['type'] === 'anytls') return false;
            if (in_array($client, ['Surge','Surfboard'], true) && in_array($n['type'], ['vless','tuic'], true)) return false;
            if ($client === 'Loon' && $n['type'] === 'tuic') return false;
            if ($client === 'QuantumultX' && in_array($n['type'], ['tuic','hysteria'], true)) return false;
            if (in_array($client, ['Clash','Stash'], true) && $n['tls'] === 2) return false;
            return true;
        }));
    }

    public static function finish(array $config, array $server, string $class): array
    {
        if (empty($server['external'])) return $config;
        if (!empty($server['external_alpn'])) {
            if (strpos($class, '\\Singbox\\') !== false) {
                if (isset($config['tls'])) $config['tls']['alpn'] = $server['external_alpn'];
            } else $config['alpn'] = $server['external_alpn'];
        }
        return $config;
    }

    public static function diagnostics(array $nodes): string
    {
        $notes = [];
        foreach (['Clash','ClashMeta','Stash','Loon','Surge','Surfboard','QuantumultX','Shadowsocks','Singbox\\Singbox','Singbox\\SingboxOld'] as $client) {
            $excluded = count($nodes) - count(self::filter($nodes, 'App\\Protocols\\' . $client));
            if ($excluded) $notes[] = $client . ' 跳过 ' . $excluded . ' 个不兼容节点';
        }
        return implode('；', $notes);
    }

    public static function uri(array $n): string
    {
        $uri = $n['external_uri'];
        if ($n['type'] === 'vmess') {
            $v = json_decode(base64_decode(strtr(substr($uri, 8), '-_', '+/')), true);
            $v['add'] = $n['host']; $v['ps'] = $n['name'];
            return 'vmess://' . base64_encode(json_encode($v, JSON_UNESCAPED_SLASHES)) . "\r\n";
        }
        $p = parse_url($uri);
        $host = strpos($n['host'], ':') !== false ? '[' . $n['host'] . ']' : $n['host'];
        if ($n['type'] === 'shadowsocks') {
            $auth = strpos($n['cipher'], '2022-') === 0
                ? rawurlencode($n['cipher']) . ':' . rawurlencode($n['external_credential'])
                : base64_encode($n['cipher'] . ':' . $n['external_credential']);
            return 'ss://' . $auth . '@' . $host . ':' . $n['port'] . '#' . rawurlencode($n['name']) . "\r\n";
        }
        $auth = $p['user'] ?? '';
        if (isset($p['pass'])) $auth .= ':' . $p['pass'];
        return $p['scheme'] . '://' . $auth . '@' . $host . ':' . $n['port'] . ($p['path'] ?? '') .
            (isset($p['query']) ? '?' . $p['query'] : '') . '#' . rawurlencode($n['name']) . "\r\n";
    }
}
