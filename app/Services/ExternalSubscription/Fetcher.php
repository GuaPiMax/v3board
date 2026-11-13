<?php
namespace App\Services\ExternalSubscription;

use RuntimeException;

class Fetcher
{
    public static function validateUrl(string $url): array
    {
        $p = parse_url($url);
        if (strlen($url) > 4096 || preg_match('/[\x00-\x20\x7f\\\\]/', $url) || !$p ||
            !in_array($p['scheme'] ?? '', ['https', 'http'], true) || empty($p['host']) ||
            isset($p['user']) || isset($p['pass']) || isset($p['fragment'])) {
            throw new RuntimeException('订阅 URL 无效（仅支持 HTTP/HTTPS，不允许内嵌用户名密码）');
        }
        return $p;
    }

    public static function publicIp(string $ip): bool
    {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
        if (strpos($ip, ':') !== false) {
            // Only global unicast, excluding mapped IPv4, transition and documentation networks.
            $bytes = inet_pton($ip);
            return (ord($bytes[0]) & 0xe0) === 0x20 &&
                substr($bytes, 0, 4) !== hex2bin('20010db8') &&
                substr($bytes, 0, 2) !== hex2bin('2002') && substr($bytes, 0, 3) !== hex2bin('200100');
        }
        $parts = array_map('intval', explode('.', $ip));
        return !($parts[0] === 100 && $parts[1] >= 64 && $parts[1] <= 127) && $parts[0] < 224 &&
            !($parts[0] === 198 && in_array($parts[1], [18,19,51], true)) &&
            !($parts[0] === 192 && $parts[1] === 0) && !($parts[0] === 203 && $parts[1] === 0);
    }

    public function fetch(string $url): string
    {
        $p = self::validateUrl($url);
        $host = trim($p['host'], '[]');
        $ips = [];
        if (filter_var($host, FILTER_VALIDATE_IP)) $ips[] = $host;
        else {
            foreach (@dns_get_record($host, DNS_A | DNS_AAAA) ?: [] as $record) {
                if (isset($record['ip'])) $ips[] = $record['ip'];
                if (isset($record['ipv6'])) $ips[] = $record['ipv6'];
            }
        }
        if (!$ips) throw new RuntimeException('域名解析失败');
        foreach ($ips as $ip) if (!self::publicIp($ip)) throw new RuntimeException('禁止访问内网或保留地址');
        $port = $p['port'] ?? ($p['scheme'] === 'https' ? 443 : 80);
        $ip = $ips[0];
        $body = ''; $tooLarge = false;
        $curl = curl_init($url);
        curl_setopt_array($curl, [CURLOPT_PROXY => '', CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_USERAGENT => 'v2rayN', CURLOPT_HTTPHEADER => ['Accept: text/plain'],
            CURLOPT_RESOLVE => [$host . ':' . $port . ':' . (strpos($ip, ':') !== false ? '[' . $ip . ']' : $ip)],
            CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$body, &$tooLarge) {
                if (strlen($body) + strlen($chunk) > Parser::MAX_BYTES) { $tooLarge = true; return 0; }
                $body .= $chunk; return strlen($chunk);
            }]);
        $ok = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($tooLarge) throw new RuntimeException('订阅超过 2 MiB');
        if ($ok === false) throw new RuntimeException('请求失败或超时');
        if ($status >= 300 && $status < 400) throw new RuntimeException('订阅返回重定向，请填写最终订阅地址');
        if ($status !== 200) throw new RuntimeException('订阅服务返回非 200 状态');
        return $body;
    }
}
