import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, Select, Space, Switch, Tag, Typography, type TableColumnsType } from 'antd'
import { useState } from 'react'
import { queryKeys } from '@/api/queries'
import {
  dropExternalSubscription,
  externalKey,
  saveExternalSubscription,
  syncExternalSubscription,
  useExternalSubscriptions,
  type ExternalSubscription,
  type SourceForm,
} from '@/api/services/externalSubscription'
import { message } from '@/app/staticApi'
import { confirmDelete } from '@/components/confirmDelete'
import { TableBlock } from '@/components/TableBlock'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'

const date = (value: number | null) => (value ? new Date(value * 1000).toLocaleString() : '尚未同步')

export default function ExternalSubscriptionPage() {
  const queryClient = useQueryClient()
  const { data, isFetching, isError, refetch } = useExternalSubscriptions()
  const [form] = Form.useForm<SourceForm>()
  const [editing, setEditing] = useState<ExternalSubscription | null | undefined>()
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState<number[]>([])
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: externalKey }),
      queryClient.invalidateQueries({ queryKey: queryKeys.plans }),
    ])
  }
  const edit = (source: ExternalSubscription | null) => {
    form.resetFields()
    form.setFieldsValue(
      source
        ? { name: source.name, enabled: Boolean(source.enabled), plan_ids: source.plan_ids, url: '' }
        : { name: '', enabled: true, plan_ids: [], url: '' },
    )
    setEditing(source)
  }
  const save = async (values: SourceForm) => {
    setSaving(true)
    try {
      const res = await saveExternalSubscription({ ...values, id: editing?.id, revision: editing?.revision })
      if (res.code === 200) {
        setEditing(undefined)
        form.resetFields()
        message.success('已保存')
        await refresh()
      } else if (res.code === 409) await refresh()
    } finally {
      setSaving(false)
    }
  }
  const sync = async (id: number) => {
    setSyncing((ids) => [...ids, id])
    try {
      const res = await syncExternalSubscription(id)
      if (res.code === 200) {
        if (res.data) message.success('同步完成')
        else message.warning('同步未完成，请查看同步结果；后台有任务正在同步时可稍后重试')
        await refresh()
      }
    } finally {
      setSyncing((ids) => ids.filter((value) => value !== id))
    }
  }
  const columns: TableColumnsType<ExternalSubscription> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      key: 'enabled',
      render: (_, row) => <Tag color={row.enabled ? 'green' : 'default'}>{row.enabled ? '启用' : '停用'}</Tag>,
    },
    {
      title: '绑定套餐',
      key: 'plans',
      render: (_, row) =>
        row.plan_ids.length ? (
          row.plan_ids.map((id) => (
            <Tag key={id}>{data?.plans.find((plan) => plan.id === id)?.name ?? `套餐 #${id}`}</Tag>
          ))
        ) : (
          <Typography.Text type="secondary">未绑定</Typography.Text>
        ),
    },
    { title: '节点数', dataIndex: 'node_count', key: 'nodes' },
    {
      title: '最近成功',
      key: 'success',
      render: (_, row) => (
        <span>
          {date(row.synced_at)}
          {row.synced_at && Date.now() / 1000 - row.synced_at > 86400 ? <Tag color="orange">缓存已过期</Tag> : null}
        </span>
      ),
    },
    {
      title: '最近尝试 / 同步结果',
      key: 'status',
      width: 280,
      render: (_, row) => (
        <>
          <div>{row.attempted_at ? date(row.attempted_at) : '尚未尝试'}</div>
          <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
            {row.status ?? '等待同步'}
          </Typography.Text>
        </>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      render: (_, row) => (
        <Space wrap>
          <Button size="small" onClick={() => edit(row)}>
            编辑
          </Button>
          <Button
            size="small"
            disabled={!row.enabled}
            loading={syncing.includes(row.id)}
            onClick={() => void sync(row.id)}
          >
            同步
          </Button>
          <Button
            size="small"
            danger
            onClick={() =>
              confirmDelete(async () => {
                const res = await dropExternalSubscription(row.id)
                if (res.code === 200) await refresh()
              })
            }
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]
  return (
    <AdminLayout title="第三方订阅">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="按套餐合并第三方节点"
        description="每 30 分钟自动刷新；同步失败时，最近成功的缓存最多保留 24 小时。套餐到期、账号封禁或本站流量用尽后停止下发。已下载的第三方节点凭据仍由第三方控制。"
      />
      {isError && (
        <Alert
          type="error"
          showIcon
          title="订阅列表加载失败"
          description={<Button onClick={() => void refetch()}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}
      <TableBlock
        loading={isFetching}
        toolbar={
          <Space wrap>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => edit(null)}>
              添加第三方订阅
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
              刷新列表
            </Button>
          </Space>
        }
      >
        <V2Table<ExternalSubscription>
          dataSource={data?.sources ?? []}
          columns={columns}
          pagination={false}
          scroll={{ x: 1200 }}
        />
      </TableBlock>
      <Drawer
        open={editing !== undefined}
        title={editing ? '编辑第三方订阅' : '添加第三方订阅'}
        size={560}
        onClose={() => {
          if (!saving) {
            setEditing(undefined)
            form.resetFields()
          }
        }}
        extra={
          <Button type="primary" loading={saving} onClick={() => form.submit()}>
            保存
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={(values) => void save(values)} disabled={saving}>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, whitespace: true, message: '请输入名称' }, { max: 100 }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            label="订阅链接"
            name="url"
            rules={[{ required: !editing, message: '请输入订阅链接' }, { max: 4096 }]}
            extra={
              editing
                ? '留空保留原链接；填写新链接会清空原节点缓存，需要重新同步。为保护凭据，不回显已保存的链接。'
                : '支持通用 Base64 订阅或节点链接列表的 HTTP(S) 地址。'
            }
          >
            <Input.Password autoComplete="new-password" placeholder={editing ? '留空保留原链接' : 'https://…'} />
          </Form.Item>
          <Form.Item label="绑定套餐" name="plan_ids" extra="可选择多个套餐；同一个套餐也可绑定多个第三方订阅。">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="请选择套餐"
              options={data?.plans.map((plan) => ({ value: plan.id, label: plan.name }))}
            />
          </Form.Item>
          <Form.Item
            label="启用"
            name="enabled"
            valuePropName="checked"
            extra="停用后，用户下一次更新订阅时不再收到该来源的节点。"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </AdminLayout>
  )
}
