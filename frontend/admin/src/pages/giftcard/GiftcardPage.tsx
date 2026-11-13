import { PlusOutlined } from '@ant-design/icons'
import { Button, Divider, Input, Modal, Select, Tag, type TableColumnsType } from 'antd'
import { useState } from 'react'
import { usePlans } from '@/api/queries'
import { dropGiftcard, fetchGiftcards, generateGiftcard } from '@/api/services/giftcard'
import type { Giftcard } from '@/api/types'
import { confirmDelete } from '@/components/confirmDelete'
import { CopyTag } from '@/components/CopyTag'
import { FormGroup } from '@/components/FormGroup'
import { JsLink } from '@/components/JsLink'
import { TableBlock } from '@/components/TableBlock'
import { V2Table } from '@/components/table/V2Table'
import { ValidityRangePicker } from '@/components/ValidityRangePicker'
import { usePagedList } from '@/hooks/usePagedList'
import { AdminLayout } from '@/layouts/AdminLayout'
import { handleGenerateResult } from '@/utils/download'
import { formatTime } from '@/utils/format'

type GiftcardType = Giftcard['type']

type GiftcardForm = Partial<Omit<Giftcard, 'value' | 'plan_id' | 'started_at' | 'ended_at' | 'limit_use'>> & {
  value?: number | string | null
  /** 编辑已有卡时是数字（原版与字符串选项匹配不上，选择框里显示的是 id），重新选择后是字符串 */
  plan_id?: number | string | null
  started_at?: number | string | null
  ended_at?: number | string | null
  limit_use?: number | string | null
  generate_count?: string
}

const DEFAULT_SUBMIT: GiftcardForm = { type: 1 }

const TYPE_TEXT: Record<GiftcardType, string> = { 1: '金额', 2: '时长', 3: '流量', 4: '重置', 5: '套餐' }
const TYPE_OPTIONS = [
  { value: 1, label: '增加账户余额' },
  { value: 2, label: '增加订阅时长' },
  { value: 3, label: '增加套餐流量' },
  { value: 4, label: '重置套餐流量' },
  { value: 5, label: '兑换订阅套餐' },
]
const UNIT: Record<GiftcardType, string> = { 1: '¥', 2: '天', 3: 'GB', 4: '', 5: '天' }

function formatValue(value: Giftcard['value'], type: GiftcardType) {
  switch (type) {
    case 1:
      return `${(value ?? 0).toFixed(2)} ¥`
    case 4:
      return '-'
    case 3:
      return `${value} GB`
    default:
      return `${value} 天`
  }
}

// 礼品卡管理（原版模块 showgiftcardpage + model giftcard）
export default function GiftcardPage() {
  const { data: plans = [] } = usePlans()
  const list = usePagedList<Giftcard>({
    key: 'giftcard',
    fetch: fetchGiftcards,
    // 与原版一致：余额卡在列表里换算成元
    select: (rows) => rows.map((row) => (row.type === 1 ? { ...row, value: (row.value ?? 0) / 100 } : row)),
  })
  const giftcards = list.rows
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submit, setSubmit] = useState<GiftcardForm>(DEFAULT_SUBMIT)

  const toggleModal = () => {
    const next = !visible
    setVisible(next)
    if (!next) setSubmit(DEFAULT_SUBMIT)
  }

  const generate = async () => {
    const params = { ...submit }
    // 有意修正：原版直接乘 100（与优惠券相同的浮点误差问题）
    if (params.type === 1) params.value = Math.round(Number(params.value) * 100)
    setSaving(true)
    const res = await generateGiftcard(params)
    setSaving(false)
    if (!handleGenerateResult(res, { batch: Boolean(params.generate_count), prefix: 'GIFTCARD', noun: '礼品卡' })) return
    void list.refetch()
    toggleModal()
  }

  const drop = async (record: Giftcard) => {
    const res = await dropGiftcard(record.id)
    if (res.code === 200) void list.refetch()
  }

  const columns: TableColumnsType<Giftcard> = [
    { title: '#', dataIndex: 'id', key: 'id' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (type: GiftcardType) => TYPE_TEXT[type] ?? '' },
    {
      title: '数值',
      dataIndex: 'value',
      key: 'value',
      render: (value: Giftcard['value'], record) => formatValue(value, record.type),
    },
    {
      title: '套餐',
      dataIndex: 'plan_id',
      key: 'plan_id',
      render: (planId: number | null) => plans.find((plan) => plan.id === planId)?.name ?? '-',
    },
    { title: '卡密', dataIndex: 'code', key: 'code', render: (code: string) => <CopyTag text={code} /> },
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
              setSubmit(giftcards[index] ?? record)
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

  const type = submit.type
  return (
    <AdminLayout title="礼品卡管理">
      <TableBlock
        bordered
        loading={list.isFetching}
        toolbar={
          <Button icon={<PlusOutlined />} onClick={toggleModal}>
            添加礼品卡
          </Button>
        }
      >
        <V2Table<Giftcard>
          dataSource={giftcards}
          columns={columns}
          scroll={{ x: 1050 }}
          pagination={list.pagination}
          onChange={list.onTableChange}
        />
      </TableBlock>
      <Modal
        title={submit.id ? '编辑礼品卡' : '新建礼品卡'}
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
              placeholder="请输入礼品卡名称"
              value={submit.name}
              onChange={(e) => setSubmit({ ...submit, name: e.target.value })}
            />
          </FormGroup>
          {!submit.generate_count && (
            <FormGroup label="自定义礼品卡卡密">
              <Input
                placeholder="自定义礼品卡卡密(留空随机生成)"
                value={submit.code}
                onChange={(e) => setSubmit({ ...submit, code: e.target.value, generate_count: undefined })}
              />
            </FormGroup>
          )}
          <FormGroup label="礼品卡类型">
            <Input
              type="number"
              addonBefore={
                <Select<GiftcardType>
                  style={{ width: 140 }}
                  value={type}
                  options={TYPE_OPTIONS}
                  onChange={(value) => setSubmit({ ...submit, type: value })}
                />
              }
              addonAfter={type ? UNIT[type] : ''}
              disabled={type === 4}
              placeholder={type === 5 ? '一次性套餐输入0' : '请输入值'}
              value={type === 4 ? 0 : (submit.value ?? undefined)}
              onChange={(e) => setSubmit({ ...submit, value: e.target.value })}
            />
          </FormGroup>
          {type === 5 && (
            <FormGroup label="指定订阅">
              <div>
                <Select<number | string>
                  value={submit.plan_id ?? undefined}
                  placeholder="指定订阅"
                  style={{ width: '100%' }}
                  options={plans.map((plan) => ({ value: `${plan.id}`, label: plan.name }))}
                  onChange={(planId) => setSubmit({ ...submit, plan_id: String(planId).length ? planId : null })}
                />
              </div>
            </FormGroup>
          )}
          <FormGroup label="礼品卡有效期">
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
