import { type TableColumnsType } from 'antd'
import { useEffect } from 'react'
import type { QueueWorkload } from '@/api/types'
import { Loading } from '@/components/Loading'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useQueueMonitorStore } from '@/stores/queueMonitor'

const QUEUE_NAME: Record<string, string> = {
  order_handle: '订单队列',
  send_email: '邮件队列',
  send_email_mass: '邮件群发队列',
  send_telegram: 'Telegram消息队列',
  stat: '统计队列',
  traffic_fetch: '流量消费队列',
}

const columns: TableColumnsType<QueueWorkload> = [
  { title: '队列名称', dataIndex: 'name', key: 'name', render: (name: string) => QUEUE_NAME[name] },
  { title: '作业量', dataIndex: 'processes', key: 'processes' },
  { title: '任务量', dataIndex: 'length', key: 'length' },
  { title: '占用时间', dataIndex: 'wait', key: 'wait', align: 'right', render: (wait: number) => `${wait}s` },
]

const ICON_STYLE = { position: 'absolute', fontSize: 100, right: -20, bottom: -20 } as const

function Stat({ label, value, className }: { label: string; value: number | undefined; className: string }) {
  return (
    <div className={className}>
      <div>
        <div>{label}</div>
        <div className="mt-4 font-size-h3">{value || '0'}</div>
      </div>
    </div>
  )
}

// 队列监控（原版模块 Jezz + model system）：每 3 秒读取一次概况与各队列负载（不等上一次返回）
export default function QueuePage() {
  const { queueStats: stats, queueWorkload: workload } = useQueueMonitorStore()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const getData = () => {
      const store = useQueueMonitorStore.getState()
      void store.getQueueStats()
      void store.getQueueWorkload()
      timer = setTimeout(getData, 3000)
    }
    getData()
    return () => clearTimeout(timer)
  }, [])

  return (
    <AdminLayout title="队列监控">
      <Loading loading={!stats}>
        <div className="block block-rounded ">
          <div className="block-header block-header-default">
            <h3 className="block-title">总览</h3>
          </div>
          <div className="block-content p-0">
            <div className="row no-gutters">
              <Stat label="当前作业量" value={stats?.jobsPerMinute} className="col-lg-6 col-xl-3 border-right p-4 border-bottom" />
              <Stat label="近一小时处理量" value={stats?.recentJobs} className="col-lg-6 col-xl-3 border-right p-4 border-bottom" />
              <Stat label="7日内报错数量" value={stats?.failedJobs} className="col-lg-6 col-xl-3 border-right p-4 border-bottom" />
              <div className="col-lg-6 col-xl-3 p-4 border-bottom overflow-hidden">
                <div>
                  <div>状态</div>
                  <div className="mt-4 font-size-h3">{stats && (stats.status ? '运行中' : '未启动')}</div>
                  {stats &&
                    (stats.status ? (
                      <i className="si si-check text-success" style={ICON_STYLE} />
                    ) : (
                      <i className="si si-close text-danger" style={ICON_STYLE} />
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Loading>
      <Loading loading={!workload}>
        <div className="block block-rounded ">
          <div className="block-header block-header-default">
            <h3 className="block-title">当前作业详情</h3>
          </div>
          <div className="block-content p-0">
            <V2Table<QueueWorkload>
              rowKey="name"
              columns={columns}
              dataSource={workload?.filter((item) => item.name !== 'default')}
              pagination={false}
            />
          </div>
        </div>
      </Loading>
    </AdminLayout>
  )
}
