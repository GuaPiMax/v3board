// 风控中心（v3board 独有，后端 insiderGuard/*）：顶部标签页切换，与系统配置页同一套 V2Tabs。
// 各标签页的内容放在同目录的组件文件里，这里只负责组合与跨标签页的联动：
//   - 概览：统计卡片 + 风险用户表，时段下拉同时决定「高风险账号」卡片与表格
//   - 风险用户表的「详情」切到「用户详情」标签页并查询该用户；「审核」与用户详情里的「审核此用户」都是弹窗（ReviewModal，
//     含限制 / 解除限制）
//   - 登记节点异常 / 保存审核成功后刷新概览；保存审核后同时刷新风险用户表（限制标记）与「用户风险详情」（审核记录、限制状态）
//   - 节点健康未开启时的提示可以直接跳到「风控设置」
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useRefetch } from '@/api/queries'
import { unwrap } from '@/api/request'
import { fetchGuardOverview } from '@/api/services/insiderGuard'
import type { GuardHours } from '@/api/types'
import { V2Tabs, type V2TabItem } from '@/components/V2Tabs'
import { AdminLayout } from '@/layouts/AdminLayout'
import { GuardSettings } from './GuardSettings'
import { NodeHealth } from './NodeHealth'
import { NodeIncidents } from './NodeIncidents'
import { OverviewCards } from './OverviewCards'
import { RecentEvents } from './RecentEvents'
import { RiskUsers } from './RiskUsers'
import { guardKeys, hoursLabel, Note, useGuardUsers } from './shared'
import { UserRiskDetail } from './UserRiskDetail'

type TabKey = 'overview' | 'events' | 'incidents' | 'health' | 'detail' | 'settings'

/** 标签页内容区：与系统配置页一样放在 block-content 里（有内边距） */
function Pane({ children }: { children: ReactNode }) {
  return <div className="block-content">{children}</div>
}

export default function InsiderGuardPage() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [hours, setHours] = useState<GuardHours>(1)
  // 从风险用户表点「详情」：seq 每次递增（同一个用户再次点击也重新查询），userId 是要查的用户；
  // 「用户风险详情」以 seq 为 key 重建并直接查询该用户
  const [detailTarget, setDetailTarget] = useState<{ seq: number; userId?: number }>({ seq: 0 })

  const queryClient = useQueryClient()
  const overview = useQuery({ queryKey: guardKeys.overview, queryFn: () => unwrap(fetchGuardOverview()) })
  const refetchOverview = useRefetch(guardKeys.overview)
  // 前缀匹配：当前查询中的任何用户详情都重新拉取
  const refetchUserDetail = useRefetch(guardKeys.userDetail)
  const users = useGuardUsers(hours)
  const highRisk = users.data ? users.data.filter((u) => u.high_risk).length : undefined

  const showDetail = (userId: number) => {
    setDetailTarget((target) => ({ seq: target.seq + 1, userId }))
    setTab('detail')
  }
  const reviewed = () => {
    void refetchOverview()
    void refetchUserDetail()
    // 限制 / 解除后风险用户表的「已限制」标记要变
    void queryClient.invalidateQueries({ queryKey: guardKeys.usersAll })
  }

  const items: V2TabItem[] = [
    {
      key: 'overview',
      label: '概览',
      children: (
        <Pane>
          <OverviewCards
            overview={overview.data}
            highRisk={highRisk}
            hoursText={hoursLabel(hours)}
            loading={overview.isLoading}
            failed={overview.isError}
          />
          <RiskUsers hours={hours} onHoursChange={setHours} onDetail={showDetail} onReviewed={reviewed} />
        </Pane>
      ),
    },
    {
      key: 'events',
      label: '最近事件',
      children: (
        <Pane>
          <RecentEvents />
        </Pane>
      ),
    },
    {
      key: 'incidents',
      label: '节点异常',
      children: (
        <Pane>
          <NodeIncidents
            incidents={overview.data?.incidents ?? []}
            loading={overview.isLoading}
            failed={overview.isError}
            onChanged={() => void refetchOverview()}
          />
        </Pane>
      ),
    },
    {
      key: 'health',
      label: '节点健康',
      children: (
        <Pane>
          <NodeHealth onOpenSettings={() => setTab('settings')} />
        </Pane>
      ),
    },
    {
      key: 'detail',
      label: '用户详情',
      children: (
        <Pane>
          <UserRiskDetail key={detailTarget.seq} initialUserId={detailTarget.userId} onReviewed={reviewed} />
        </Pane>
      ),
    },
    {
      key: 'settings',
      label: '风控设置',
      children: (
        <Pane>
          <GuardSettings />
        </Pane>
      ),
    },
  ]

  return (
    <AdminLayout title="风控中心">
      <div className="block block-rounded">
        <V2Tabs activeKey={tab} onChange={(key) => setTab(key as TabKey)} size="large" items={items} />
        {/* 所有标签页共用的页脚说明 */}
        <div className="block-content block-content-full" style={{ paddingTop: 0 }}>
          <Note>数据仅用于异常排查；共享出口、网络切换和客户端重试均可能造成误报。请合理设置保留周期。</Note>
        </div>
      </div>
    </AdminLayout>
  )
}
