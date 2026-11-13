import { PlusOutlined } from '@ant-design/icons'
import { Button, Divider, Input, Modal, Select, Switch, Tag, type TableColumnsType } from 'antd'
import { useState } from 'react'
import { usePlans } from '@/api/queries'
import { dropCoupon, fetchCoupons, generateCoupon, toggleCouponShow } from '@/api/services/coupon'
import type { Coupon } from '@/api/types'
import { confirmDelete } from '@/components/confirmDelete'
import { CopyTag } from '@/components/CopyTag'
import { FormGroup } from '@/components/FormGroup'
import { JsLink } from '@/components/JsLink'
import { TableBlock } from '@/components/TableBlock'
import { ValidityRangePicker } from '@/components/ValidityRangePicker'
import { V2Table } from '@/components/table/V2Table'
import { usePagedList } from '@/hooks/usePagedList'
import { AdminLayout } from '@/layouts/AdminLayout'
import { PERIOD_KEYS, PERIOD_TEXT } from '@/utils/constants'
import { handleGenerateResult } from '@/utils/download'
import { formatTime } from '@/utils/format'

type CouponForm = Partial<Omit<Coupon, 'value' | 'started_at' | 'ended_at' | 'limit_use' | 'limit_use_with_user'>> & {
  value?: number | string
  started_at?: number | string | null
  ended_at?: number | string | null
  limit_use?: number | string | null
  limit_use_with_user?: number | string | null
  generate_count?: string
}

const DEFAULT_SUBMIT: CouponForm = { type: 1 }

const TYPE_OPTIONS = [
  { value: 1, label: '按金额优惠' },
  { value: 2, label: '按比例优惠' },
]
const PERIOD_OPTIONS = PERIOD_KEYS.map((key) => ({ value: key, label: PERIOD_TEXT[key] }))

// 优惠券管理（原版模块 Q55k + model coupon）
export default function CouponPage() {
  const { data: plans = [] } = usePlans()
  const list = usePagedList<Coupon>({
    key: 'coupon',
    fetch: fetchCoupons,
    // 与原版一致：按金额优惠的券在列表里换算成元
    select: (rows) => rows.map((row) => (row.type === 1 ? { ...row, value: row.value / 100 } : row)),
  })
  const coupons = list.rows
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submit, setSubmit] = useState<CouponForm>(DEFAULT_SUBMIT)

  const toggleModal = () => {
    const next = !visible
    setVisible(next)
    if (!next) setSubmit(DEFAULT_SUBMIT)
  }

  const generate = async () => {
    const params = { ...submit }
    // 有意修正：原版直接乘 100（19.99 会变成 1998.9999999999998，被后端判为「金额或比例格式有误」）
    if (params.type === 1) params.value = Math.round(Number(params.value) * 100)
    setSaving(true)
    const res = await generateCoupon(params)
    setSaving(false)
    if (!handleGenerateResult(res, { batch: Boolean(params.generate_count), prefix: 'COUPON', noun: '优惠券' })) return
    void list.refetch()
    toggleModal()
  }

  const drop = async (record: Coupon) => {
    const res = await dropCoupon(record.id)
    if (res.code === 200) void list.refetch()
  }

  const columns: TableColumnsType<Coupon> = [
    { title: '#', dataIndex: 'id', key: 'id' },
    {
      title: '启用',
      dataIndex: 'show',
      key: 'show',
      render: (show: number, record) => (
        <Switch
          size="small"
          checked={Boolean(show)}
          onChange={async () => {
            const res = await toggleCouponShow(record.id)
            if (res.code === 200) void list.refetch()
          }}
        />
      ),
    },
    { title: '券名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (type: number) => (type === 1 ? '金额' : '比例') },
    { title: '券码', dataIndex: 'code', key: 'code', render: (code: string) => <CopyTag text={code} /> },
    {
      title: '剩余次数',
      dataIndex: 'limit_use',
      key: 'limit_use',
      render: (value: number | null) => <Tag>{value !== null ? value : '无限'}</Tag>,
    },
    {
      title: '有效期',
      dataIndex: 'started_at',
      key: 'started_at',
      align: 'left',
      render: (_: unknown, record) => `${formatTime(record.started_at)} ~ ${formatTime(record.ended_at)}`,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      align: 'right',
      fixed: 'right',
      render: (_: unknown, record, index) => (
        <div>
          <JsLink
            onClick={() => {
              setSubmit(coupons[index] ?? record)
              setVisible(true)
            }}
          >
            编辑
          </JsLink>
          <Divider orientation="vertical" />
          <JsLink onClick={() => confirmDelete(() => drop(record))}>删除</JsLink>
        </div>
      ),
    },
  ]

  return (
    <AdminLayout title="优惠券管理">
      <TableBlock
        bordered
        loading={list.isFetching}
        toolbar={
          <Button icon={<PlusOutlined />} onClick={toggleModal}>
            添加优惠券
          </Button>
        }
      >
        <V2Table<Coupon>
          dataSource={coupons}
          columns={columns}
          scroll={{ x: 1050 }}
          pagination={list.pagination}
          onChange={list.onTableChange}
        />
      </TableBlock>
      <Modal
        title={submit.id ? '编辑优惠券' : '新建优惠券'}
        open={visible}
        onCancel={toggleModal}
        onOk={() => void generate()}
        okText="提交"
        cancelText="取消"
        okButtonProps={{ loading: saving }}
      >
        <div>
          <FormGroup label="名称">
            <Input
              placeholder="请输入优惠券名称"
              value={submit.name}
              onChange={(e) => setSubmit({ ...submit, name: e.target.value })}
            />
          </FormGroup>
          {!submit.generate_count && (
            <FormGroup label="自定义优惠券码">
              <Input
                placeholder="自定义优惠券码(留空随机生成)"
                value={submit.code}
                onChange={(e) => setSubmit({ ...submit, code: e.target.value, generate_count: undefined })}
              />
            </FormGroup>
          )}
          <FormGroup label="优惠信息">
            <Input
              type="number"
              addonBefore={
                <Select<1 | 2>
                  style={{ width: 120 }}
                  value={submit.type}
                  options={TYPE_OPTIONS}
                  onChange={(type) => setSubmit({ ...submit, type })}
                />
              }
              addonAfter={submit.type === 1 ? '¥' : '%'}
              placeholder="请输入值"
              value={submit.value}
              onChange={(e) => setSubmit({ ...submit, value: e.target.value })}
            />
          </FormGroup>
          <FormGroup label="优惠券有效期">
            <ValidityRangePicker
              startedAt={submit.started_at}
              endedAt={submit.ended_at}
              onChange={(started_at, ended_at) => setSubmit({ ...submit, started_at, ended_at })}
            />
          </FormGroup>
          <FormGroup label="最大使用次数">
            <Input
              placeholder="限制最大使用次数，用完则无法使用(为空则不限制)"
              value={submit.limit_use ?? undefined}
              onChange={(e) => setSubmit({ ...submit, limit_use: e.target.value })}
            />
          </FormGroup>
          <FormGroup label="每个用户可使用次数">
            <Input
              placeholder="限制每个用户可使用次数(为空则不限制)"
              value={submit.limit_use_with_user ?? undefined}
              onChange={(e) => setSubmit({ ...submit, limit_use_with_user: e.target.value })}
            />
          </FormGroup>
          <FormGroup label="指定订阅">
            <div>
              <Select<string[]>
                mode="multiple"
                value={submit.limit_plan_ids || []}
                placeholder="限制指定订阅可以使用优惠(为空则不限制)"
                style={{ width: '100%' }}
                options={plans.map((plan) => ({ value: `${plan.id}`, label: plan.name }))}
                onChange={(ids) => setSubmit({ ...submit, limit_plan_ids: ids.length ? ids : null })}
              />
            </div>
          </FormGroup>
          <FormGroup label="指定周期">
            <div>
              <Select<string[]>
                mode="multiple"
                value={submit.limit_period || []}
                placeholder="限制指定周期可以使用优惠(为空则不限制)"
                style={{ width: '100%' }}
                options={PERIOD_OPTIONS}
                onChange={(periods) => setSubmit({ ...submit, limit_period: periods.length ? periods : null })}
              />
            </div>
          </FormGroup>
          {!submit.code && !submit.id && (
            <FormGroup label="生成数量">
              <Input
                placeholder="输入数量批量生成"
                value={submit.generate_count}
                onChange={(e) => setSubmit({ ...submit, generate_count: e.target.value, code: undefined })}
              />
            </FormGroup>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
