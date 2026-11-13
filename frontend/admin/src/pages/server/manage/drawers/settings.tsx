// 子抽屉里的配置表单（原版模块 uzXD 的 U / EncryptionSettings、3XVG 的 b）。
// 与原版一致：只在打开子抽屉时从节点读取一次；修改任意一项后把整份配置交回节点（未修改时节点里的值保持不变）。
import { Input, Select, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { text } from './shared'

type Settings = Record<string, unknown>

const isEmpty = (settings: unknown) => !settings || JSON.stringify(settings) === '{}'
const flag = (value: unknown) => Boolean(Number.parseInt(String(value), 10))

function useSettings(initial: unknown, defaults: () => Settings, onChange: (settings: Settings) => void) {
  const [settings, setSettings] = useState<Settings>(() => (isEmpty(initial) ? defaults() : (initial as Settings)))
  const change = (key: string, value: unknown) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    onChange(next)
  }
  return [settings, change] as const
}

interface TlsSettingsProps {
  settings: unknown
  /** 0 无 / 1 TLS / 2 Reality（打开子抽屉时的值） */
  tls: unknown
  /** 显示证书申请相关字段（仅 V2node） */
  certApply?: boolean
  onChange: (settings: Settings) => void
}

/** 安全性配置（Vless、V2node）：TLS 与 Reality 共用 */
export function TlsSettings({ settings: initial, tls: tlsProp, certApply: certProp, onChange }: TlsSettingsProps) {
  const [settings, change] = useSettings(
    initial,
    () => ({
      server_name: '',
      cert_mode: 'self',
      provider: '',
      dns_env: '',
      reject_unknown_sni: '0',
      allow_insecure: '0',
    }),
    onChange,
  )
  // 与原版一致：tls、cert_apply 只在创建时读取
  const [tls] = useState(tlsProp)
  const [certApply] = useState(certProp)
  // 与原版一致使用宽松比较（值可能是数字或字符串）
  const isTls = tls == 1
  const isReality = tls == 2
  const e = settings

  return (
    <>
      <div>
        <div className="form-group">
          <label>Server Name(SNI)</label>
          <Input
            value={text(e.server_name)}
            onChange={(ev) => change('server_name', ev.target.value)}
            placeholder={isReality ? 'REALITY必填，与后端保持一致' : ''}
          />
        </div>
        {isTls && certApply && (
          <div className="form-group">
            <label>证书模式Cert Mode</label>
            <Select<string>
              value={(e.cert_mode as string | undefined) ?? 'self'}
              style={{ width: '100%' }}
              onChange={(v) => change('cert_mode', v)}
              options={[
                { value: 'self', label: '自签名' },
                { value: 'remote', label: '自签名(面板下发)' },
                { value: 'http', label: 'HTTP申请' },
                { value: 'dns', label: 'DNS申请' },
                { value: 'none', label: '无证书(关闭TLS)' },
              ]}
            />
          </div>
        )}
        {e.cert_mode == 'dns' && certApply && (
          <div className="form-group">
            <label>
              DNS解析提供商Provider{' '}
              <a target="_blank" href="https://go-acme.github.io/lego/dns/index.html" rel="noreferrer">
                填写参考
              </a>
            </label>
            <Input
              value={text(e.provider)}
              onChange={(ev) => change('provider', ev.target.value)}
              placeholder="书写格式cloudflare"
            />
          </div>
        )}
        {e.cert_mode == 'dns' && certApply && (
          <div className="form-group">
            <label>DNS env</label>
            <Input
              value={text(e.dns_env)}
              onChange={(ev) => change('dns_env', ev.target.value)}
              placeholder="书写格式CF_DNS_API_TOKEN=xxxxxxx如有多条使用逗号,分隔"
            />
          </div>
        )}
        {isTls && e.cert_mode != 'none' && certApply && (
          <div className="form-group">
            <label>证书公钥文件地址Cert File Path</label>
            <Input
              value={text(e.cert_file)}
              onChange={(ev) => change('cert_file', ev.target.value)}
              placeholder="留空在/etc/v2node/目录自动生成"
            />
          </div>
        )}
        {isTls && e.cert_mode != 'none' && certApply && (
          <div className="form-group">
            <label>证书私钥文件地址Key File Path</label>
            <Input
              value={text(e.key_file)}
              onChange={(ev) => change('key_file', ev.target.value)}
              placeholder="留空在/etc/v2node/目录自动生成"
            />
          </div>
        )}
        {isTls && e.cert_mode == 'remote' && certApply && (
          <div className="form-group">
            <label>pinnedPeerCertSha256</label>
            <Input
              value={text(e.pinned_peer_cert_sha256)}
              readOnly
              // 皮肤里取 --v2b-readonly-bg（见 styles/skins/_shell.scss），legacy 下为原值
              style={{ backgroundColor: 'var(--v2b-readonly-bg, #f5f5f5a0)', cursor: 'text' }}
              placeholder="自动生成"
            />
          </div>
        )}
        {isReality && (
          <div className="form-group">
            <label>Server Address</label>
            <Input
              value={text(e.dest)}
              onChange={(ev) => change('dest', ev.target.value)}
              placeholder="REALITY目标地址,默认使用SNI"
            />
          </div>
        )}
        {isReality && (
          <div className="form-group">
            <label>Server Port</label>
            <Input
              value={text(e.server_port)}
              onChange={(ev) => change('server_port', ev.target.value)}
              placeholder="REALITY目标端口,默认443"
            />
          </div>
        )}
        {isReality && (
          <div className="form-group">
            <label>Proxy Protocol</label>
            <Select<number>
              value={Number.parseInt(String(e.xver), 10) || 0}
              style={{ width: '100%' }}
              onChange={(v) => change('xver', v)}
              options={[0, 1, 2].map((v) => ({ value: v, label: String(v) }))}
            />
          </div>
        )}
        {isReality && (
          <div className="form-group">
            <label>Private Key</label>
            <Input
              value={text(e.private_key)}
              onChange={(ev) => change('private_key', ev.target.value)}
              placeholder="留空自动生成"
            />
          </div>
        )}
        {isReality && (
          <div className="form-group">
            <label>Public Key</label>
            <Input
              value={text(e.public_key)}
              onChange={(ev) => change('public_key', ev.target.value)}
              placeholder="留空自动生成"
            />
          </div>
        )}
        {isReality && (
          <div className="form-group">
            <label>ShortId</label>
            <Input
              value={text(e.short_id)}
              onChange={(ev) => change('short_id', ev.target.value)}
              placeholder="留空自动生成"
            />
          </div>
        )}
        <div className="form-group">
          <label>FingerPrint</label>
          <Select<string>
            value={e.fingerprint as string | undefined}
            style={{ width: '100%' }}
            onChange={(v) => change('fingerprint', v)}
            placeholder="TLS指纹默认Chrome"
            options={[
              { value: 'chrome', label: 'Chrome' },
              { value: 'firefox', label: 'Firefox' },
              { value: 'safari', label: 'Safari' },
              { value: 'ios', label: 'IOS' },
              { value: 'android', label: 'Android' },
              { value: 'edge', label: 'Edge' },
              { value: '360', label: '360' },
              { value: 'qq', label: 'QQ' },
            ]}
          />
        </div>
        {isTls && certApply && (
          <div className="form-group">
            <label>Reject unknown sni</label>
            <div>
              <Switch checked={flag(e.reject_unknown_sni)} onChange={(v) => change('reject_unknown_sni', v ? '1' : '0')} />
            </div>
          </div>
        )}
        <div className="form-group">
          <label>Allow Insecure</label>
          <div>
            <Switch checked={flag(e.allow_insecure)} onChange={(v) => change('allow_insecure', v ? '1' : '0')} />
          </div>
        </div>
        <div className="form-group">
          <label>ECH (Encrypted Client Hello)</label>
          <Select<string>
            value={(e.ech as string | undefined) || ''}
            style={{ width: '100%' }}
            onChange={(v) => change('ech', v)}
            placeholder="选择 ECH 模式"
            options={[
              { value: '', label: '无' },
              { value: 'cloudflare', label: 'Cloudflare' },
              { value: 'custom', label: '自定义 SNI' },
            ]}
          />
        </div>
        {e.ech === 'cloudflare' && (
          // 皮肤里取 --v2b-success-*（见 styles/skins/_shell.scss），legacy 下为原值
          <div
            className="form-group"
            style={{
              background: 'var(--v2b-success-bg, #f6ffed)',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--v2b-success-line, #b7eb8f)',
            }}
          >
            <span style={{ color: 'var(--v2b-success-text, #52c41a)' }}>
              ✓ Cloudflare 托管 ECH，密钥由 Cloudflare 自动管理，客户端从 DNS 自动获取配置，服务端无需配置
            </span>
          </div>
        )}
        {e.ech === 'custom' && (
          <div className="form-group">
            <label>ECH Server Name (伪装域名/外层SNI)</label>
            <Input
              value={(e.ech_server_name as string | undefined) || ''}
              onChange={(ev) => change('ech_server_name', ev.target.value)}
              placeholder="必填"
            />
          </div>
        )}
        {e.ech === 'custom' && (
          <div className="form-group">
            <label>ECH Key (服务端私钥)</label>
            <Input
              value={(e.ech_key as string | undefined) || ''}
              onChange={(ev) => change('ech_key', ev.target.value)}
              placeholder="留空自动生成"
            />
          </div>
        )}
        {e.ech === 'custom' && (
          <div className="form-group">
            <label>ECH Config (客户端配置)</label>
            <Input
              value={(e.ech_config as string | undefined) || ''}
              onChange={(ev) => change('ech_config', ev.target.value)}
              placeholder="留空自动生成"
            />
          </div>
        )}
      </div>
    </>
  )
}

/**
 * VLESS 加密配置（Vless、V2node 的 mlkem768x25519plus）。
 * 与原版一致：一打开就把当前配置（为空时是默认值）交回节点，所以只要打开过，提交时就会带上这份配置
 */
export function EncryptionSettings({ settings: initial, onChange }: { settings: unknown; onChange: (settings: Settings) => void }) {
  const [settings, change] = useSettings(
    initial,
    () => ({
      mode: 'native',
      rtt: '0rtt',
      ticket: '600s',
      server_padding: null,
      client_padding: null,
      private_key: null,
      password: null,
    }),
    onChange,
  )
  useEffect(() => {
    onChange(settings)
    // 只在打开时执行一次（原版在构造函数里调用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const e = settings

  return (
    <>
      <div>
        <div className="form-group">
          <label>Mode</label>
          <Select<string>
            value={e.mode as string | undefined}
            style={{ width: '100%' }}
            onChange={(v) => change('mode', v)}
            options={['native', 'xorpub', 'random'].map((v) => ({ value: v, label: v }))}
          />
        </div>
        <div className="row">
          <div className="form-group col-md-6 col-xs-12">
            <label>RTT</label>
            <Select<string>
              value={e.rtt as string | undefined}
              style={{ width: '100%' }}
              onChange={(v) => change('rtt', v)}
              options={['0rtt', '1rtt'].map((v) => ({ value: v, label: v }))}
            />
          </div>
          {e.rtt === '0rtt' && (
            <div className="form-group col-md-6 col-xs-12">
              <label>Ticket time</label>
              <Input value={text(e.ticket)} onChange={(ev) => change('ticket', ev.target.value)} placeholder="最长允许时间" />
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Server Padding</label>
          <Input
            value={text(e.server_padding)}
            onChange={(ev) => change('server_padding', ev.target.value)}
            placeholder="留空使用默认值100-111-1111.75-0-111.50-0-3333"
          />
        </div>
        <div className="form-group">
          <label>Private Key</label>
          <Input
            value={text(e.private_key)}
            onChange={(ev) => change('private_key', ev.target.value)}
            placeholder="留空自动生成，需抗量子加密请自行替换"
          />
        </div>
        <div className="form-group">
          <label>Client Padding</label>
          <Input
            value={text(e.client_padding)}
            onChange={(ev) => change('client_padding', ev.target.value)}
            placeholder="留空使用默认值100-111-1111.75-0-111.50-0-3333"
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <Input
            value={text(e.password)}
            onChange={(ev) => change('password', ev.target.value)}
            placeholder="留空自动生成，需抗量子加密请自行替换"
          />
        </div>
      </div>
    </>
  )
}

/** Vmess 的 TLS 配置（驼峰字段：serverName / allowInsecure） */
export function VmessTlsSettings({ settings: initial, onChange }: { settings: unknown; onChange: (settings: Settings) => void }) {
  const [settings, change] = useSettings(initial, () => ({ serverName: '', allowInsecure: 0 }), onChange)
  return (
    <>
      <div>
        <div className="form-group">
          <label>Server Name</label>
          <Input
            value={text(settings.serverName)}
            onChange={(ev) => change('serverName', ev.target.value)}
            placeholder="不使用请留空"
          />
        </div>
        <div className="form-group">
          <label>Allow Insecure</label>
          <div>
            <Switch checked={flag(settings.allowInsecure)} onChange={(v) => change('allowInsecure', v ? '1' : '0')} />
          </div>
        </div>
      </div>
    </>
  )
}
