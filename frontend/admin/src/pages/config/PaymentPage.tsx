import { PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { Button, Divider, Switch, Tooltip, type TableColumnsType } from 'antd'
import { useEffect } from 'react'
import type { Payment } from '@/api/types'
import { modal } from '@/app/staticApi'
import { JsLink } from '@/components/JsLink'
import { TableBlock } from '@/components/TableBlock'
import { DragHandle } from '@/components/table/DragHandle'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'
import { usePaymentManageStore } from '@/stores/paymentManage'
import { PaymentModal } from './PaymentModal'

// 与原版一致：确认框的 onOk 返回删除请求，请求结束前「确定」显示加载中（优惠券等页面的确认框点了立即关闭）
const drop = (id: number) =>
  modal.confirm({
    title: '警告',
    content: '确定要删除该条项目吗？',
    onOk: () => usePaymentManageStore.getState().drop(id),
    okText: '确定',
    cancelText: '取消',
  })

// 支付配置（原版模块 eIZb + model payment）
export default function PaymentPage() {
  const { payments, fetchLoading } = usePaymentManageStore()

  useEffect(() => {
    void usePaymentManageStore.getState().fetch()
  }, [])

  const columns: TableColumnsType<Payment> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: number) => (
        <>
          <DragHandle /> {id}
        </>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enable',
      key: 'enable',
      render: (enable: number, record) => (
        <Switch
          checked={Boolean(Number.parseInt(String(enable), 10))}
          size="small"
          onChange={() => void usePaymentManageStore.getState().show(record.id)}
        />
      ),
    },
    { title: '显示名称', dataIndex: 'name', key: 'name' },
    { title: '支付接口', dataIndex: 'payment', key: 'payment' },
    {
      title: (
        <span>
          通知地址{' '}
          <Tooltip placement="top" title="支付网关将会把数据通知到本地址，请通过防火墙放行本地址。">
            <QuestionCircleOutlined />
          </Tooltip>
        </span>
      ),
      dataIndex: 'notify_url',
      key: 'notify_url',
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      align: 'right',
      fixed: 'right',
      render: (_: unknown, record) => (
        <>
          <PaymentModal key={record.id} record={record}>
            <JsLink>编辑</JsLink>
          </PaymentModal>
          <Divider type="vertical" />
          <JsLink onClick={() => drop(record.id)}>删除</JsLink>
        </>
      ),
    },
  ]

  return (
    <AdminLayout title="支付配置">
      <TableBlock
        loading={fetchLoading}
        toolbar={
          <PaymentModal key={0}>
            <Button icon={<PlusOutlined />}>添加支付方式</Button>
          </PaymentModal>
        }
      >
        <V2Table<Payment>
          dataSource={payments}
          columns={columns}
          pagination={false}
          scroll={{ x: 1300 }}
          onDragSort={(from, to) => void usePaymentManageStore.getState().sort(from, to)}
        />
      </TableBlock>
    </AdminLayout>
  )
}
