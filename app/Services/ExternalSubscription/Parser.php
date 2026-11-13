<?php

namespace App\Services\ExternalSubscription;

use InvalidArgumentException;

/** Parses data, never executes providers' configuration or fetches nested URLs. */
class Parser
{
    public const MAX_BYTES = 2097152;
    public const MAX_NODES = 1000;

    public function parse(string $body): array
    {
        if (strlen($body) > self::MAX_BYTES) throw new InvalidArgumentException('订阅超过 2 MiB');
        $body = trim(preg_replace('/^\xEF\xBB\xBF/', '', $body));
        if (strpos($body, '://') === false) $body = $this->decode(preg_replace('/\s+/', '', $body));
        $body = trim(preg_replace('/^\xEF\xBB\xBF/', '', $body));
        $nodes = []; $errors = []; $seen = [];
        $lines = preg_split('/\r\n|\n|\r/', $body);
        if (count($lines) > 5000) throw new InvalidArgumentException('订阅行数过多');
        foreach ($lines as $i => $line) {
            $line = trim($line);
            if ($line === '') continue;
            try {
                $node = $this->node($line);
                $key = hash('sha256', $line);
                if (isset($seen[$key])) continue;
                $seen[$key] = true;
                $nodes[] = $node;
                if (count($nodes) > self::MAX_NODES) throw new \LengthException('节点数量超过 1000');
            } catch (InvalidArgumentException $e) {
                // Never include the input URI, credentials, or exception from a third-party parser.
                if (count($errors) < 50) $errors[] = '第 ' . ($i + 1) . ' 行：' . $e->getMessage();
            }
        }
        return ['nodes' => $nodes, 'errors' => $errors];
    }

    private function decode(string $text): string
    {
        $result = base64_decode(strtr($text, '-_', '+/'), true);
        if ($result === false || $result === '') throw new InvalidArgumentException('Base64 无效');
        return $result;
    }

    private function text($value, int $max = 512): string
    {
        if (!is_scalar($value) || strlen((string)$value) > $max || !mb_check_encoding((string)$value, 'UTF-8') || preg_match('/[\x00-\x1f\x7f]/', (string)$value)) {
            throw new InvalidArgumentException('字段无效或过长');
        }
        return (string)$value;
    }

    private function node(string $uri): array
    {
        if (strlen($uri) > 16384) throw new InvalidArgumentException('节点链接过长');
        $scheme = strtolower(strtok($uri, ':'));
        if (!in_array($scheme, ['ss', 'vmess', 'vless', 'trojan', 'hy2', 'hysteria2', 'tuic', 'anytls'], true)) {
            throw new InvalidArgumentException('不支持的节点协议');
        }
        $n = ['external' => true, 'type' => $scheme, 'network' => 'tcp', 'network_settings' => [],
            'tls' => 0, 'tls_settings' => [], 'flow' => '', 'version' => 2, 'rate' => 1,
            'parent_id' => null, 'created_at' => 0, 'updated_at' => 0, 'sort' => 0,
            'disable_sni' => 0, 'zero_rtt_handshake' => 0, 'udp_relay_mode' => 'native',
            'congestion_control' => 'cubic', 'insecure' => 0, 'server_name' => '', 'up_mbps' => 100, 'down_mbps' => 100];
        $q = [];
        if ($scheme === 'vmess') {
            $v = json_decode($this->decode(substr($uri, 8)), true, 32);
            if (!is_array($v)) throw new InvalidArgumentException('VMess JSON 无效');
            if (!in_array($v['tls'] ?? '', ['', 'tls'], true)) throw new InvalidArgumentException('不支持的 VMess 安全参数');
            foreach ($v as $key => $value) {
                if (!in_array($key, ['v','ps','add','port','id','aid','net','type','host','path','tls','sni','fp','alpn','scy'], true) && $value !== '') throw new InvalidArgumentException('包含尚未支持的 VMess 参数');
                $this->text($value, 2048);
            }
            $n['host'] = $v['add'] ?? ''; $n['port'] = $v['port'] ?? 0;
            $n['name'] = $v['ps'] ?? 'VMess'; $n['external_credential'] = $v['id'] ?? '';
            if ((int)($v['aid'] ?? 0) !== 0) throw new InvalidArgumentException('仅支持 VMess AEAD（alterId=0）');
            if (!in_array($v['scy'] ?? 'auto', ['auto', ''], true)) throw new InvalidArgumentException('暂不支持该 VMess 加密参数');
            $q = ['type' => $v['net'] ?? 'tcp', 'security' => ($v['tls'] ?? '') === 'tls' ? 'tls' : 'none',
                'sni' => $v['sni'] ?? '', 'host' => $v['host'] ?? '', 'path' => $v['path'] ?? '',
                'serviceName' => $v['path'] ?? '', 'fp' => $v['fp'] ?? 'chrome'];
            if (!empty($v['alpn'])) $q['alpn'] = $v['alpn'];
            if (!empty($v['type']) && $v['type'] !== 'none') throw new InvalidArgumentException('暂不支持该 VMess 伪装参数');
        } else {
            // Legacy SS encodes the entire authority, SIP002 only encodes userinfo.
            if ($scheme === 'ss' && strpos(explode('#', substr($uri, 5), 2)[0], '@') === false) {
                $parts = explode('#', substr($uri, 5), 2);
                $uri = 'ss://' . $this->decode($parts[0]) . (isset($parts[1]) ? '#' . $parts[1] : '');
            }
            $p = parse_url($uri);
            if (!is_array($p) || empty($p['host'])) throw new InvalidArgumentException('节点地址无效');
            $n['host'] = trim($p['host'], '[]'); $n['port'] = $p['port'] ?? 0;
            $n['name'] = rawurldecode($p['fragment'] ?? $scheme);
            parse_str($p['query'] ?? '', $q);
            foreach ($q as $value) $this->text($value, 2048);
            $auth = rawurldecode($p['user'] ?? '');
            if ($scheme === 'ss') {
                $auth = isset($p['pass']) ? $auth . ':' . rawurldecode($p['pass']) : $this->decode($auth);
                $credentials = explode(':', $auth, 2);
                if (count($credentials) !== 2) throw new InvalidArgumentException('SS 凭据无效');
                [$n['cipher'], $n['external_credential']] = $credentials;
                if (!in_array($n['cipher'], ['aes-128-gcm','aes-192-gcm','aes-256-gcm','chacha20-ietf-poly1305','2022-blake3-aes-128-gcm','2022-blake3-aes-256-gcm','2022-blake3-chacha20-poly1305'], true)) throw new InvalidArgumentException('不支持的 SS 加密方式');
                $n['type'] = 'shadowsocks';
            } else {
                $n['external_credential'] = $auth;
                if ($scheme === 'tuic') $n['external_password'] = rawurldecode($p['pass'] ?? '');
                elseif (isset($p['pass'])) $n['external_credential'] .= ':' . rawurldecode($p['pass']);
            }
        }
        if (in_array($scheme, ['hy2','hysteria2'], true)) $n['type'] = 'hysteria';
        $n['host'] = $this->text($n['host'], 253);
        if (!filter_var($n['host'], FILTER_VALIDATE_IP) && !preg_match('/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/D', $n['host'])) throw new InvalidArgumentException('节点主机名无效');
        if (!ctype_digit((string)$n['port']) || (int)$n['port'] < 1 || (int)$n['port'] > 65535) throw new InvalidArgumentException('节点端口无效');
        $n['port'] = (int)$n['port'];
        $n['name'] = $this->text($n['name'], 200);
        $n['external_credential'] = $this->text($n['external_credential'], 1024);
        if ($n['external_credential'] === '') throw new InvalidArgumentException('缺少节点凭据');
        if ($scheme === 'ss' && strpos($n['cipher'], '2022-') === 0) {
            $keyLength = $n['cipher'] === '2022-blake3-aes-128-gcm' ? 16 : 32;
            foreach (explode(':', $n['external_credential']) as $key) {
                $decoded = base64_decode($key, true);
                if ($decoded === false || strlen($decoded) !== $keyLength) throw new InvalidArgumentException('SS 2022 密钥长度或编码无效');
            }
        }
        if (in_array($scheme, ['vmess','vless','tuic'], true) && !preg_match('/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iD', $n['external_credential'])) throw new InvalidArgumentException('UUID 无效');
        if ($scheme === 'tuic' && $this->text($n['external_password'], 1024) === '') throw new InvalidArgumentException('缺少 TUIC 密码');
        $allowed = ['type','security','sni','peer','host','path','serviceName','fp','pbk','sid','flow','encryption',
            'allowInsecure','allow_insecure','insecure','alpn','obfs','obfs-password','congestion_control','udp_relay_mode','disable_sni','zero_rtt_handshake'];
        foreach ($q as $k => $value) {
            if ($value !== '' && !in_array($k, $allowed, true)) throw new InvalidArgumentException('包含尚未支持的连接参数');
        }
        $n['network'] = $q['type'] ?? 'tcp';
        if (!in_array($n['network'], ['tcp','ws','grpc'], true)) throw new InvalidArgumentException('不支持的传输方式');
        if ($n['network'] === 'ws') $n['network_settings'] = ['path' => $this->text($q['path'] ?? '/', 2048), 'headers' => ['Host' => $this->text($q['host'] ?? '')]];
        if ($n['network'] === 'grpc') $n['network_settings'] = ['serviceName' => $this->text($q['serviceName'] ?? '')];
        $security = $q['security'] ?? (in_array($scheme, ['trojan','hy2','hysteria2','tuic','anytls'], true) ? 'tls' : 'none');
        if (!in_array($security, ['none','tls','reality'], true)) throw new InvalidArgumentException('不支持的安全参数');
        if (in_array($scheme, ['trojan','hy2','hysteria2','tuic','anytls'], true) && $security !== 'tls') throw new InvalidArgumentException('该协议必须使用 TLS');
        if (in_array($scheme, ['ss','hy2','hysteria2','tuic','anytls'], true) && $n['network'] !== 'tcp') throw new InvalidArgumentException('该协议不支持指定传输方式');
        if ($scheme === 'ss' && $security !== 'none') throw new InvalidArgumentException('SS 不支持指定安全参数');
        $n['tls'] = $security === 'reality' ? 2 : ($security === 'tls' ? 1 : 0);
        $n['server_name'] = $this->text($q['sni'] ?? $q['peer'] ?? '');
        $insecure = $q['insecure'] ?? $q['allowInsecure'] ?? $q['allow_insecure'] ?? '0';
        if (!in_array((string)$insecure, ['0','1','true','false'], true)) throw new InvalidArgumentException('TLS 校验参数无效');
        $n['insecure'] = in_array((string)$insecure, ['1','true'], true) ? 1 : 0;
        $n['tls_settings'] = ['server_name' => $n['server_name'], 'allow_insecure' => $n['insecure'],
            'fingerprint' => $this->text($q['fp'] ?? 'chrome'), 'public_key' => $this->text($q['pbk'] ?? ''), 'short_id' => $this->text($q['sid'] ?? '')];
        if ($n['tls'] === 2 && ($scheme !== 'vless' || empty($q['pbk']))) throw new InvalidArgumentException('Reality 参数不完整或协议不支持');
        if ($n['tls'] === 2 && (!preg_match('/^[A-Za-z0-9_-]{43}$/D', $n['tls_settings']['public_key']) || !preg_match('/^(?:[a-fA-F0-9]{2}){0,8}$/D', $n['tls_settings']['short_id']))) throw new InvalidArgumentException('Reality 公钥或 short ID 格式无效');
        $n['flow'] = $this->text($q['flow'] ?? '');
        if (!in_array($n['flow'], ['', 'xtls-rprx-vision'], true)) throw new InvalidArgumentException('不支持的 VLESS flow');
        if ($n['flow'] !== '' && ($scheme !== 'vless' || $n['network'] !== 'tcp' || !$n['tls'])) throw new InvalidArgumentException('VLESS flow 与传输参数不兼容');
        if (!empty($q['encryption']) && $q['encryption'] !== 'none') throw new InvalidArgumentException('不支持的 VLESS 加密参数');
        if (!empty($q['alpn'])) $n['external_alpn'] = explode(',', $this->text($q['alpn']));
        if (!empty($n['external_alpn']) && !$n['tls']) throw new InvalidArgumentException('非 TLS 节点不能指定 ALPN');
        if (!empty($q['obfs'])) {
            if ($n['type'] !== 'hysteria' || $q['obfs'] !== 'salamander' || empty($q['obfs-password'])) throw new InvalidArgumentException('不支持的混淆参数');
            $n['obfs'] = 'salamander'; $n['obfs_password'] = $this->text($q['obfs-password']);
        }
        foreach (['congestion_control','udp_relay_mode','disable_sni','zero_rtt_handshake'] as $key) if (isset($q[$key])) $n[$key] = $this->text($q[$key]);
        if (!in_array($n['congestion_control'], ['cubic','bbr','new_reno'], true) || !in_array($n['udp_relay_mode'], ['native','quic'], true)) throw new InvalidArgumentException('TUIC 参数无效');
        foreach (['disable_sni','zero_rtt_handshake'] as $key) {
            if (!in_array((string)$n[$key], ['0','1','true','false'], true)) throw new InvalidArgumentException('TUIC 布尔参数无效');
            $n[$key] = in_array((string)$n[$key], ['1','true'], true) ? 1 : 0;
        }
        // Preserve the original URI for URI clients, but never bypass endpoint rewrites or decoy policy.
        $n['external_uri'] = $uri;
        $n['networkSettings'] = $n['network_settings'];
        $n['tlsSettings'] = $n['tls_settings'] + ['serverName' => $n['server_name'], 'allowInsecure' => $n['insecure']];
        $n['allow_insecure'] = $n['insecure'];
        return $n;
    }
}
