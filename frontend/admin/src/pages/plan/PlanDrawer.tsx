import { InfoCircleOutlined } from '@ant-design/icons'
import { Alert, Button, Checkbox, Col, Divider, Drawer, Input, Row, Select, Tooltip } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { queryKeys, useRefetch, useServerGroups, useSiteConfig } from '@/api/queries'
import { fetchPlans, savePlan } from '@/api/services/plan'
import { useExternalSubscriptions } from '@/api/services/externalSubscription'
import type { Plan } from '@/api/types'
import { FormGroup } from '@/components/FormGroup'
import { JsLink } from '@/components/JsLink'
import { GroupModal } from '@/pages/server/group/GroupModal'
import { PERIOD_KEYS, type PeriodKey } from '@/utils/constants'

/** 表单里的订阅：价格单位为元；输入框里改过的值是字符串 */
export type PlanForm = {
  external_subscription_ids?: number[]
  external_binding_token?: string
  id?: number
  show?: number
  renew?: number
  name?: string | null
  content?: string | null
  transfer_enable?: number | string | null
  device_limit?: number | string | null
  group_id?: number | null
  reset_traffic_method?: number | null
  capacity_limit?: number | string | null
  speed_limit?: number | string | null
  force_update?: boolean
} & { [key in PeriodKey]?: number | string | null }

// 与原版一致的新建默认值（键的顺序就是提交时参数的顺序）
const DEFAULT_RECORD: PlanForm = {
  show: 0,
  name: null,
  transfer_enable: null,
  group_id: undefined,
  month_price: null,
  quarter_price: null,
  half_year_price: null,
  year_price: null,
  two_year_price: null,
  three_year_price: null,
  onetime_price: null,
  reset_price: null,
}

const PRICE_FIELDS: Array<[PeriodKey, string]> = [
  ['month_price', '月付'],
  ['quarter_price', '季付'],
  ['half_year_price', '半年'],
  ['year_price', '年付'],
  ['two_year_price', '两年付'],
  ['three_year_price', '三年付'],
]

const RESET_METHOD_OPTIONS = [
  { value: null, label: '跟随系统设置' },
  { value: 0, label: '每月1号' },
  { value: 1, label: '按月重置' },
  { value: 2, label: '不重置' },
  { value: 3, label: '每年1月1日' },
  { value: 4, label: '按年重置' },
]

interface PlanDrawerProps {
  record?: PlanForm | Plan
  /** 点击后打开抽屉的元素（原版用 cloneElement 覆盖它的 onClick） */
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

// 新建 / 编辑订阅抽屉；打开编辑时重新读取套餐，避免使用另一个页面修改绑定前的缓存。
export function PlanDrawer({ record: initial, children }: PlanDrawerProps) {
  const [visible, setVisible] = useState(false)
  const [record, setRecord] = useState<PlanForm>(() => initial ?? DEFAULT_RECORD)
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const sources = useExternalSubscriptions(visible)
  const { data: groups = [] } = useServerGroups()
  const { data: config } = useSiteConfig()
  const currency = config?.site?.currency_symbol as string | undefined
  const refetchPlans = useRefetch(queryKeys.plans)

  const change = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => setRecord((r) => ({ ...r, [key]: value }))
  const priceChange = (key: PeriodKey, value: string) => change(key, value !== '' ? value : null)
  const priceValue = (key: PeriodKey) => (record[key] !== null ? (record[key] as number | string) : undefined)

  const save = async () => {
    const params: PlanForm = { ...record }
    // 与原版一致：价格由元换算成分（四舍五入）
    for (const key of PERIOD_KEYS) {
      if (params[key] !== null) params[key] = Math.round(100 * Number(params[key]))
    }
    setSaving(true)
    const res = await savePlan(params)
    setSaving(false)
    if (res.code !== 200) return
    void refetchPlans()
    setVisible(false)
  }

  const open = async () => {
    if (opening) return
    setOpening(true)
    try {
      if (initial?.id) {
        const res = await fetchPlans()
        if (res.code !== 200) return
        const latest = res.data?.find((plan) => plan.id === initial.id)
        if (!latest) {
          void refetchPlans()
          return
        }
        const next: PlanForm = { ...latest }
        for (const key of PERIOD_KEYS) if (next[key] != null) next[key] = Number(next[key]) / 100
        setRecord(next)
      } else setRecord({ ...DEFAULT_RECORD, external_subscription_ids: [] })
      setVisible(true)
    } finally {
      setOpening(false)
    }
  }

  return (
    <>
      {cloneElement(children, { onClick: () => void open() })}
      <Drawer
        id="plan"
        onClose={() => setVisible(false)}
        title={record.id ? '编辑订阅' : '新建订阅'}
        open={visible}
        size="80%"
      >
        <div>
          <FormGroup label="套餐名称">
            <Input
              placeholder="请输入套餐名称"
              value={record.name ?? undefined}
              onChange={(e) => change('name', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="套餐描述">
            <Input.TextArea
              rows={4}
              value={record.content ?? undefined}
              placeholder="请输入套餐描述，支持HTML"
              onChange={(e) => change('content', e.target.value)}
            />
          </FormGroup>
          <Divider titlePlacement="center">
            售价设置{' '}
            <Tooltip placement="top" title="将金额留空则不会进行出售">
              <InfoCircleOutlined />
            </Tooltip>
          </Divider>
          <Row gutter={10}>
            {PRICE_FIELDS.map(([key, label]) => (
              <Col md={4} key={key}>
                <FormGroup label={label}>
                  <Input value={priceValue(key)} onChange={(e) => priceChange(key, e.target.value)} />
                </FormGroup>
              </Col>
            ))}
          </Row>
          <Row gutter={10}>
            <Col md={12}>
              <FormGroup label="一次性">
                <Input
                  addonAfter={currency}
                  value={priceValue('onetime_price')}
                  onChange={(e) => priceChange('onetime_price', e.target.value)}
                />
              </FormGroup>
            </Col>
            <Col md={12}>
              <FormGroup label="重置包">
                <Input
                  addonAfter={currency}
                  value={priceValue('reset_price')}
                  onChange={(e) => priceChange('reset_price', e.target.value)}
                />
              </FormGroup>
            </Col>
          </Row>
          <Divider />
          <FormGroup label="套餐流量">
            <Input
              addonAfter="GB"
              placeholder="请输入套餐流量"
              value={record.transfer_enable ?? undefined}
              onChange={(e) => change('transfer_enable', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="设备数限制">
            <Input
              placeholder="留空则不限制"
              value={record.device_limit ?? undefined}
              onChange={(e) => change('device_limit', e.target.value)}
            />
          </FormGroup>
          <FormGroup
            label={
              <>
                权限组{' '}
                <GroupModal>
                  <JsLink>添加权限组</JsLink>
                </GroupModal>
              </>
            }
          >
            <Select<number>
              placeholder="请选择权限组"
              style={{ width: '100%' }}
              value={record.group_id ?? undefined}
              options={groups.map((group) => ({ value: group.id, label: group.name }))}
              onChange={(value) => change('group_id', value)}
            />
          </FormGroup>
          <Divider>第三方订阅</Divider>
          {sources.isError && (
            <Alert
              type="error"
              title="来源列表加载失败"
              description={<Button onClick={() => void sources.refetch()}>重试</Button>}
            />
          )}
          <FormGroup label="绑定第三方订阅">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              placeholder="可选择多个来源，留空则只下发本站节点"
              loading={sources.isFetching}
              disabled={sources.isError || sources.isFetching}
              value={record.external_subscription_ids ?? []}
              options={sources.data?.sources.map((source) => ({
                value: source.id,
                label: `${source.name}${source.enabled ? '' : '（已停用）'}`,
              }))}
              onChange={(ids: number[]) => change('external_subscription_ids', ids)}
            />
            <p style={{ marginTop: 8 }}>
              第三方流量不计入本站。到期、封禁或本站流量用尽后停止下发；已下载的第三方凭据仍由第三方控制。
            </p>
          </FormGroup>
          <FormGroup label="流量重置方式">
            {/* 原版占位文字就是「请选择权限组」 */}
            <Select<number | null>
              placeholder="请选择权限组"
              style={{ width: '100%' }}
              value={record.reset_traffic_method}
              options={RESET_METHOD_OPTIONS}
              onChange={(value) => change('reset_traffic_method', value)}
            />
          </FormGroup>
          <FormGroup label="最大容纳用户量">
            <Input
              placeholder="留空则不限制"
              value={record.capacity_limit ?? undefined}
              onChange={(e) => change('capacity_limit', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="限速">
            <Input
              addonAfter="Mbps"
              placeholder="留空则不限制"
              value={record.speed_limit ?? undefined}
              onChange={(e) => change('speed_limit', e.target.value)}
            />
          </FormGroup>
          <div className="v2board-drawer-action">
            <div style={{ float: 'left', marginTop: 5 }}>
              <Tooltip title="勾选后变更的流量、限速、权限组将应用到该套餐下的用户" placement="top">
                <Checkbox onChange={(e) => change('force_update', e.target.checked)}>强制更新到用户</Checkbox>
              </Tooltip>
            </div>
            <Button style={{ marginRight: 8 }} onClick={() => setVisible(false)}>
              取消
            </Button>
            <Button loading={saving} onClick={() => saving || void save()} type="primary">
              提交
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  )
}
