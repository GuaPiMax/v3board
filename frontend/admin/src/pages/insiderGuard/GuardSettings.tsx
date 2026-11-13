// 风控设置（独占一个标签页）：config/fetch?key=insider_guard 读取初值，整组提交 config/save
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, InputNumber, Switch } from 'antd'
import { useState, type ReactNode } from 'react'
import { unwrap } from '@/api/request'
import { fetchConfig, saveConfig } from '@/api/services/config'
import { message } from '@/app/staticApi'
import { Loading } from '@/components/Loading'
import { Failed, guardKeys, MUTED, Note, Section } from './shared'

interface GuardConfig {
  /** 高风险阈值：评分达到该值标为高风险 */
  insider_guard_risk_threshold: number
  /** 审计记录保留天数 1～365 */
  insider_guard_retention_days: number
  /** 节点 TCP 健康检查开关 0 / 1 */
  insider_guard_health_enable: number
  /** TCP 连接超时秒数 1～5 */
  insider_guard_health_timeout: number
  /** 同一告警的冷却分钟数 */
  insider_guard_alert_cooldown_minutes: number
  /** 假入口地址：被限制的用户拉订阅时所有节点的连接地址都换成它；留空则后端按用户生成固定的假公网 IPv4 */
  insider_guard_decoy_host: string
}

type NumberKey = Exclude<keyof GuardConfig, 'insider_guard_decoy_host'>

const DEFAULTS: GuardConfig = {
  insider_guard_risk_threshold: 50,
  insider_guard_retention_days: 3,
  insider_guard_health_enable: 0,
  insider_guard_health_timeout: 2,
  insider_guard_alert_cooldown_minutes: 120,
  insider_guard_decoy_host: '',
}

/** 假入口地址：IPv6（至少两个冒号，可带方括号，后端会去掉）| IPv4（四段数字）| 域名 三选一，与后端 ConfigSave 的校验一致 */
const HOST_PATTERN =
  /^(\[[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*\]|[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*|\d{1,3}(?:\.\d{1,3}){3}|[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*)$/

/** 后端返回的值可能是字符串，统一转成整数；不是数字时用默认值 */
function normalize(raw: Record<string, unknown> | undefined): GuardConfig {
  const int = (key: NumberKey) => {
    const value = Number.parseInt(String(raw?.[key] ?? ''), 10)
    return Number.isNaN(value) ? DEFAULTS[key] : value
  }
  return {
    insider_guard_risk_threshold: int('insider_guard_risk_threshold'),
    insider_guard_retention_days: int('insider_guard_retention_days'),
    insider_guard_health_enable: int('insider_guard_health_enable'),
    insider_guard_health_timeout: int('insider_guard_health_timeout'),
    insider_guard_alert_cooldown_minutes: int('insider_guard_alert_cooldown_minutes'),
    insider_guard_decoy_host: String(raw?.insider_guard_decoy_host ?? '').trim(),
  }
}

/** 输入框后面的单位 */
function Unit({ children }: { children: ReactNode }) {
  return <span style={{ ...MUTED, marginLeft: 8 }}>{children}</span>
}

/** 一行设置：左边标题和说明，右边控件（与系统配置页同一种左文右控件的布局） */
function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="row" style={{ padding: '16px 0', borderBottom: '1px solid var(--v2b-line-soft, #eee)' }}>
      <div className="col-lg-8">
        <div style={{ fontWeight: 'bold', marginBottom: 5 }}>{title}</div>
        <div style={MUTED}>{description}</div>
      </div>
      <div className="col-lg-4 text-right">{children}</div>
    </div>
  )
}

export function GuardSettings() {
  const config = useQuery({
    queryKey: guardKeys.config,
    queryFn: () => unwrap(fetchConfig('insider_guard')),
  })
  const retry = (
    <Button size="small" loading={config.isFetching} onClick={() => void config.refetch()}>
      重试
    </Button>
  )
  return (
    <Section>
      <Loading loading={config.isLoading}>
        {config.data ? (
          <>
            {/* 已经读到过配置、重新读取失败：表单不重建，保留当前显示的值（含未保存的修改） */}
            {config.isError && <Note style={{ padding: '12px 0 0' }}>重新读取失败，表单保留当前显示的值 {retry}</Note>}
            {/* 重新读取到配置时（key 变化）按新值重建表单，覆盖未保存的修改 */}
            <SettingsForm key={config.dataUpdatedAt} initial={normalize(config.data.insider_guard)} />
          </>
        ) : config.isError ? (
          <Failed>读取失败：风控设置暂时无法加载 {retry}</Failed>
        ) : (
          <div style={{ minHeight: 120 }} />
        )}
      </Loading>
    </Section>
  )
}

function SettingsForm({ initial }: { initial: GuardConfig }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<GuardConfig>(initial)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof GuardConfig>(key: K, value: GuardConfig[K] | null) => {
    if (value === null) return
    setForm((f) => ({ ...f, [key]: value }))
  }

  const save = async () => {
    if (form.insider_guard_retention_days < 1 || form.insider_guard_retention_days > 365) {
      return message.error('审计保留天数需在 1～365 之间')
    }
    if (form.insider_guard_health_timeout < 1 || form.insider_guard_health_timeout > 5) {
      return message.error('TCP 超时需在 1～5 秒之间')
    }
    const host = form.insider_guard_decoy_host.trim()
    if (host && !HOST_PATTERN.test(host)) return message.error('假入口地址只能填域名或 IP')
    setSaving(true)
    const res = await saveConfig({ ...form, insider_guard_decoy_host: host })
    setSaving(false)
    if (res.code !== 200 || res.data !== true) return
    message.success('保存成功')
    // 阈值影响风险用户的高风险判定与用户详情里的「需人工复核」，开关影响「节点健康」标签页的提示
    void queryClient.invalidateQueries({ queryKey: guardKeys.config })
    void queryClient.invalidateQueries({ queryKey: guardKeys.usersAll })
    void queryClient.invalidateQueries({ queryKey: guardKeys.userDetail })
    void queryClient.invalidateQueries({ queryKey: guardKeys.health })
  }

  return (
    <>
      <Row
        title="高风险阈值"
        description="风险评分达到该值的账号标为高风险。当前评分规则最高 50 分（订阅次数、来源 IP 数各 25 分），默认 50"
      >
        <InputNumber
          min={0}
          max={100}
          value={form.insider_guard_risk_threshold}
          onChange={(v) => set('insider_guard_risk_threshold', v)}
        />
      </Row>
      <Row
        title="审计保留天数"
        description="登录 / 订阅事件、节点下发记录、健康探测记录的保留天数，1～365，默认 3；小于 2 天时节点异常的候选账号可能不全。每个活跃设备每天约 24 行、每行约 0.4 KB"
      >
        <InputNumber
          min={1}
          max={365}
          value={form.insider_guard_retention_days}
          onChange={(v) => set('insider_guard_retention_days', v)}
        />
        <Unit>天</Unit>
      </Row>
      <Row
        title="节点健康检查"
        description="开启后由定时任务每 5 分钟对显示中的节点做一次 TCP 连通性探测，连续两次失败时告警"
      >
        <Switch
          checked={form.insider_guard_health_enable === 1}
          onChange={(checked) => set('insider_guard_health_enable', checked ? 1 : 0)}
        />
      </Row>
      <Row title="TCP 超时" description="健康探测的连接超时秒数，1～5，默认 2">
        <InputNumber
          min={1}
          max={5}
          value={form.insider_guard_health_timeout}
          onChange={(v) => set('insider_guard_health_timeout', v)}
        />
        <Unit>秒</Unit>
      </Row>
      <Row title="告警冷却" description="同一告警在冷却时间内只通过 Telegram 发送一次，最少 10 分钟，默认 120">
        <InputNumber
          min={10}
          max={525600}
          value={form.insider_guard_alert_cooldown_minutes}
          onChange={(v) => set('insider_guard_alert_cooldown_minutes', v)}
        />
        <Unit>分钟</Unit>
      </Row>
      <Row
        title="假入口地址"
        description="被限制的用户拉订阅时，所有节点的连接地址都换成这个域名或 IP，端口、凭据不变（节点名只在与地址相同时替换）。留空则为每个被限制的用户生成一个固定的、看起来像公网的假 IPv4（240～254 开头的保留段，全网不可路由）；也可以填自己的蜜罐服务器"
      >
        <Input
          style={{ width: 220 }}
          placeholder="留空自动生成"
          maxLength={253}
          value={form.insider_guard_decoy_host}
          onChange={(e) => set('insider_guard_decoy_host', e.target.value)}
        />
      </Row>
      <div style={{ padding: '16px 0' }}>
        <Button type="primary" loading={saving} onClick={() => void save()}>
          保存
        </Button>
      </div>
    </>
  )
}
