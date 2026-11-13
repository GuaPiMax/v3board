// 风控中心「概览」标签页顶部的统计卡片：近 24 小时事件、人工审核总数、限制中账号、节点异常事件、所选时段内的高风险账号
import type { ReactNode } from 'react'
import type { GuardOverview } from '@/api/types'
import { Loading } from '@/components/Loading'
import { Failed, MUTED } from './shared'

interface OverviewCardsProps {
  overview?: GuardOverview
  /** 当前所选时段内 high_risk 的账号数（风险用户列表还没返回时为 undefined） */
  highRisk?: number
  /** 时段文案，显示在「高风险账号」卡片下方 */
  hoursText: string
  loading?: boolean
  /** 概览请求失败（卡片显示 -，并给出提示） */
  failed?: boolean
}

function Card({ icon, label, value, hint }: { icon: string; label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <div className="block block-rounded block-bordered mb-0" style={{ height: '100%' }}>
        <div className="block-content block-content-full">
          <i className={`fa ${icon} fa-2x text-gray-light float-right`} />
          <div className="text-muted mb-1">{label}</div>
          <div className="display-4 text-black font-w300">{value}</div>
          {hint && <div style={MUTED}>{hint}</div>}
        </div>
      </div>
    </div>
  )
}

/** 还没读取到时显示 - */
const value = (n: number | undefined) => (n === undefined ? '-' : n)

export function OverviewCards({ overview, highRisk, hoursText, loading, failed }: OverviewCardsProps) {
  return (
    <Loading loading={loading}>
      {/* 用网格排卡片：按宽度自动分列，手机 1 列 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <Card icon="fa-bolt" label="近 24 小时事件" value={value(overview?.recent_events)} hint="登录与订阅拉取" />
        <Card icon="fa-clipboard-check" label="人工审核总数" value={value(overview?.reviews)} />
        <Card icon="fa-ban" label="限制中账号" value={value(overview?.restricted)} hint="拉订阅时下发假入口" />
        <Card
          icon="fa-exclamation-triangle"
          label="节点异常事件"
          value={value(overview?.incidents.length)}
          hint="最近登记的 20 条"
        />
        <Card icon="fa-user-shield" label="高风险账号" value={value(highRisk)} hint={hoursText} />
      </div>
      {failed && <Failed>读取失败：统计数据暂时无法加载，请刷新页面重试</Failed>}
    </Loading>
  )
}
