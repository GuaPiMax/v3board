// 用户流量记录弹窗（原版模块 X0q5；用户管理「TA的流量记录」、工单详情的流量图标）。与原版一致：
//   - 每次打开都按当前页重新读取，关闭后保留上次的记录与页码（再打开时先显示旧记录）
//   - 请求参数为 { user_id, ...分页 }：初始分页是 { page: 1, pageSize: 10, total: 0 }（page 不是后端参数），
//     翻页后带上 current
import { Modal, type ModalProps, type TableColumnsType } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { getStatUser } from '@/api/services/stat'
import type { StatUserRecord } from '@/api/types'
import { Loading } from '@/components/Loading'
import { V2Table } from '@/components/table/V2Table'
import { useUi } from '@/stores/appearance'
import { formatBytes, formatTime } from '@/utils/format'

interface TrafficLogModalProps {
  userId?: number
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

// 表格贴着弹窗的左右和底边（原版 bodyStyle 的 padding 为 0）。antd 6 的内边距在外层容器上（legacy 由兼容层清零，
// 只去掉内容区的就行）；皮肤（antd 6 观感）下去掉容器左右和底部的内边距，标题保留 antd 6 默认的左右内边距
const FLUSH_STYLES: ModalProps['styles'] = { body: { padding: 0 } }
const SKIN_FLUSH_STYLES: ModalProps['styles'] = {
  container: { paddingInline: 0, paddingBottom: 0 },
  header: { paddingInline: 24 },
}

interface TrafficPagination {
  page: number
  pageSize: number
  total: number
  current?: number
}

const columns: TableColumnsType<StatUserRecord> = [
  { title: '日期', dataIndex: 'record_at', key: 'record_at', render: (value: number) => formatTime(value, 'YYYY-MM-DD') },
  // 原版上行、下行两列的 key 都是 d（只影响 React 的列 key，这里改用 u 避免重复）
  { title: '上行', dataIndex: 'u', key: 'u', align: 'right', render: (value: number) => formatBytes(value) },
  { title: '下行', dataIndex: 'd', key: 'd', align: 'right', render: (value: number) => formatBytes(value) },
  { title: '倍率', dataIndex: 'server_rate', key: 'server_rate', align: 'right' },
]

export function TrafficLogModal({ userId, children }: TrafficLogModalProps) {
  const [visible, setVisible] = useState(false)
  const [records, setRecords] = useState<StatUserRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState<TrafficPagination>({ page: 1, pageSize: 10, total: 0 })
  const flushStyles = useUi() === 'legacy' ? FLUSH_STYLES : SKIN_FLUSH_STYLES

  const load = async (current: TrafficPagination) => {
    setLoading(true)
    const res = await getStatUser({ user_id: userId, ...current })
    setLoading(false)
    if (res.code !== 200) return
    setRecords(res.data ?? [])
    setPagination({ ...current, total: res.total ?? 0 })
  }

  return (
    <>
      {cloneElement(children, {
        onClick: () => {
          setVisible(true)
          void load(pagination)
        },
      })}
      <Modal
        width="100%"
        style={{ maxWidth: 1000, padding: '0 10px', top: 20 }}
        styles={flushStyles}
        onCancel={() => setVisible(false)}
        footer={null}
        open={visible}
        title="流量记录"
      >
        <Loading loading={loading}>
          <V2Table<StatUserRecord>
            pagination={{
              // 翻页前不受控（原版的分页对象里没有 current）
              ...(pagination.current === undefined ? {} : { current: pagination.current }),
              pageSize: pagination.pageSize,
              total: pagination.total,
              size: 'small',
            }}
            columns={columns}
            dataSource={records}
            onChange={(next) => {
              const updated = { ...pagination, current: next.current ?? 1, pageSize: next.pageSize ?? pagination.pageSize }
              setPagination(updated)
              void load(updated)
            }}
          />
        </Loading>
      </Modal>
    </>
  )
}
