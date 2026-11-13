import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { unwrap } from '@/api/request'
import { fetchConfig } from '@/api/services/config'
import { fetchHorizonStats } from '@/api/services/monitor'
import {
  getOrder,
  getOverride,
  getServerLastRank,
  getServerTodayRank,
  getUserLastRank,
  getUserTodayRank,
} from '@/api/services/stat'
import type { StatOrderItem, UserRankItem } from '@/api/types'
import { EChart, type EChartOption } from '@/components/echarts/EChart'
import { JsLink } from '@/components/JsLink'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useOrderManageStore } from '@/stores/orderManage'

// 仪表盘（原版模块 sFYk）
export default function DashboardPage() {
  const navigate = useNavigate()

  const queue = useQuery({ queryKey: ['monitor', 'stats'], queryFn: fetchHorizonStats })
  const override = useQuery({ queryKey: ['stat', 'override'], queryFn: () => unwrap(getOverride()) })
  const order = useQuery({ queryKey: ['stat', 'order'], queryFn: () => unwrap(getOrder()) })
  const serverLast = useQuery({ queryKey: ['stat', 'serverLastRank'], queryFn: () => unwrap(getServerLastRank()) })
  const serverToday = useQuery({ queryKey: ['stat', 'serverTodayRank'], queryFn: () => unwrap(getServerTodayRank()) })
  const userToday = useQuery({ queryKey: ['stat', 'userTodayRank'], queryFn: () => unwrap(getUserTodayRank()) })
  const userLast = useQuery({ queryKey: ['stat', 'userLastRank'], queryFn: () => unwrap(getUserLastRank()) })
  const site = useQuery({ queryKey: ['config', 'site'], queryFn: () => unwrap(fetchConfig('site')), staleTime: Infinity })

  const stat = override.data ?? {}
  const currency = (site.data?.site?.currency as string | undefined) ?? ''
  const queueStatus = queue.data?.status as string | undefined

  const orderOption = useMemo(() => order.data && buildOrderOption(order.data), [order.data])
  const serverTodayOption = useMemo(
    () => serverToday.data && buildRankOption(serverToday.data.map((v) => [v.server_name ?? '', v.total])),
    [serverToday.data],
  )
  const serverLastOption = useMemo(
    () => serverLast.data && buildRankOption(serverLast.data.map((v) => [v.server_name ?? '', v.total])),
    [serverLast.data],
  )
  const userTodayOption = useMemo(
    () => userToday.data && buildRankOption(userToday.data.map((v: UserRankItem) => [v.email, v.total])),
    [userToday.data],
  )
  const userLastOption = useMemo(
    () => userLast.data && buildRankOption(userLast.data.map((v: UserRankItem) => [v.email, v.total])),
    [userLast.data],
  )

  const alerts = []
  if (stat.ticket_pending_total) {
    alerts.push(
      <div key="ticket" className="alert alert-danger" role="alert">
        <p className="mb-0">
          有 {stat.ticket_pending_total} 条工单等待处理{' '}
          <JsLink className="alert-link" onClick={() => navigate('/ticket')}>
            立即处理
          </JsLink>
        </p>
      </div>,
    )
  }
  if (stat.commission_pending_total) {
    alerts.push(
      <div key="commission" className="alert alert-danger" role="alert">
        <p className="mb-0">
          有 {stat.commission_pending_total} 笔佣金等待确认{' '}
          <JsLink
            className="alert-link"
            onClick={() => {
              // 设置好条件再跳到订单管理，由订单页挂载时拉取一次
              useOrderManageStore.getState().presetFilter([
                { key: 'status', condition: '=', value: '3' },
                { key: 'commission_status', condition: '=', value: '0' },
                { key: 'commission_balance', condition: '>', value: '0' },
              ])
              navigate('/order')
            }}
          >
            立即处理
          </JsLink>
        </p>
      </div>,
    )
  }

  const shortcut = (path: string, icon: string, label: string) => (
    <div className="col-sm-6 col-xl-3 js-appear-enabled animated" data-toggle="appear">
      <a className="block block-bordered block-link-pop text-center mb-0" onClick={() => navigate(path)}>
        <div className="block-content block-content-full text-center">
          <i className={`fa-2x si ${icon} text-primary d-none d-sm-inline-block mb-3`} />
          <div className="font-w600 text-uppercase">{label}</div>
        </div>
      </a>
    </div>
  )

  return (
    <AdminLayout title="仪表盘">
      {queueStatus && queueStatus !== 'running' && (
        <div className="row">
          <div className="col-lg-12">
            <div className="alert alert-danger" role="alert">
              <p className="mb-0">当前队列服务运行异常，可能会导致业务无法使用。</p>
            </div>
          </div>
        </div>
      )}
      {alerts}
      <div className="mb-0 block border-bottom js-classic-nav d-none d-sm-block">
        <div className="block-content block-content-full">
          <div className="row no-gutters border">
            {shortcut('/config/system', 'si-equalizer', '系统设置')}
            {shortcut('/order', 'si-list', '订单管理')}
            {shortcut('/plan', 'si-bag', '订阅管理')}
            {shortcut('/user', 'si-users', '用户管理')}
          </div>
        </div>
      </div>
      <div className="row no-gutters">
        <div className="col-lg-12 js-appear-enabled animated" data-toggle="appear">
          <div className="block border-bottom mb-0 v2board-stats-bar">
            <div className="block-content">
              <div className="d-flex align-items-center">
                <div className="pr-4 pr-sm-5 pl-0 pl-sm-3 ">
                  <i className="fa fa-users fa-2x text-gray-light float-right" />
                  <div className="text-muted mb-1" style={{ width: '120px' }}>
                    在线人数
                  </div>
                  <div className="display-4 text-black font-w300 mb-2">{stat.online_user ? stat.online_user : '0'}</div>
                </div>
                <div className="pr-4 pr-sm-5 pl-0 pl-sm-3 ">
                  <i className="fa fa-chart-line fa-2x text-gray-light float-right" />
                  <p className="text-muted w-75 mb-1">今日收入</p>
                  <p className="display-4 text-black font-w300 mb-2">
                    {stat.day_income ? (stat.day_income / 100).toFixed(2) : '0.00'}
                    <span className="font-size-h5 font-w600 text-muted">{currency}</span>
                  </p>
                </div>
                <div className="pr-4 pr-sm-5 pl-0 pl-sm-3 ">
                  <i className="fa fa-user fa-2x text-gray-light float-right" />
                  {/* v3board：原版为「实时注册」 */}
                  <div className="text-muted mb-1" style={{ width: '120px' }}>
                    今日注册
                  </div>
                  <div className="display-4 text-black font-w300 mb-2">
                    {stat.day_register_total ? stat.day_register_total : '0'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-12 js-appear-enabled animated" data-toggle="appear">
          <div className="block border-bottom mb-0 v2board-stats-bar">
            <div className="block-content block-content-full">
              {/* 原版这里用了 Bootstrap 5 的 fs-3 / border-start，在 Bootstrap 4 下不生效，保持一致 */}
              <div className="d-flex align-items-center">
                <div className="pr-4 pr-sm-5 pl-0 pl-sm-3">
                  <p className="fs-3 text-dark mb-0">
                    {stat.month_income ? (stat.month_income / 100).toFixed(2) : '0.00'} {currency}
                  </p>
                  <p className="text-muted mb-0">本月收入</p>
                </div>
                <div className="px-4 px-sm-5 border-start">
                  <p className="fs-3 text-dark mb-0">
                    {stat.last_month_income ? (stat.last_month_income / 100).toFixed(2) : '0.00'} {currency}
                  </p>
                  <p className="text-muted mb-0">上月收入</p>
                </div>
                <div className="px-4 px-sm-5 border-start">
                  <p className="fs-3 text-dark mb-0">
                    {stat.commission_last_month_payout ? (stat.commission_last_month_payout / 100).toFixed(2) : '0.00'}{' '}
                    {currency}
                  </p>
                  <p className="text-muted mb-0">上月佣金支出</p>
                </div>
                <div className="px-4 px-sm-5 border-start">
                  <p className="fs-3 text-dark mb-0">{stat.month_register_total || '-'}</p>
                  <p className="text-muted mb-0">本月新增用户</p>
                </div>
                {/* v3board：总用户、累计 / 有效付费用户（stat/getOverride 追加的字段） */}
                <div className="px-4 px-sm-5 border-start">
                  <p className="fs-3 text-dark mb-0">{stat.total_user || '0'}</p>
                  <p className="text-muted mb-0">总用户</p>
                </div>
                <div className="px-4 px-sm-5 border-start">
                  <p className="fs-3 text-dark mb-0">{stat.paid_user_total || '0'}</p>
                  <p className="text-muted mb-0">累计付费用户</p>
                </div>
                <div className="px-4 px-sm-5 border-start">
                  <p className="fs-3 text-dark mb-0">{stat.paid_user_active || '0'}</p>
                  <p className="text-muted mb-0">有效付费用户</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-12 js-appear-enabled animated" data-toggle="appear">
          <div className="block border-bottom mb-0">
            <EChart className="px-sm-3 pt-sm-3 py-3 clearfix" id="orderChart" style={{ height: 400 }} option={orderOption} />
          </div>
        </div>
      </div>
      <div className="row mt-xl-3">
        <RankBlock title="今日节点流量排行" id="serverTodayRankChart" option={serverTodayOption} extra=" pr-xl-1" />
        <RankBlock title="昨日节点流量排行" id="serverLastRankChart" option={serverLastOption} />
        <RankBlock title="今日用户流量排行" id="userTodayRankChart" option={userTodayOption} extra=" pr-xl-1" />
        <RankBlock title="昨日用户流量排行" id="userLastRankChart" option={userLastOption} />
      </div>
    </AdminLayout>
  )
}

interface RankBlockProps {
  title: string
  id: string
  option?: EChartOption
  extra?: string
}

/** 流量排行卡片 */
function RankBlock({ title, id, option, extra = '' }: RankBlockProps) {
  return (
    <div className={`col-lg-6 js-appear-enabled animated${extra}`} data-toggle="appear">
      <div className="block border-bottom">
        <div className="block-header block-header-default">
          <h3 className="block-title">{title}</h3>
        </div>
        <div className="block-content">
          <EChart className="px-sm-3 pt-sm-3 py-3 clearfix" id={id} style={{ height: 400 }} option={option} />
        </div>
      </div>
    </div>
  )
}

/** 收款 / 注册等折线图（原版 orderChartRender） */
function buildOrderOption(items: StatOrderItem[]): EChartOption {
  const legend: string[] = []
  const dates: string[] = []
  const series: Array<{ name: string; type: 'line'; smooth: boolean; data: number[] }> = []
  for (const item of items) {
    if (!legend.includes(item.type)) legend.push(item.type)
    if (!dates.includes(item.date)) dates.push(item.date)
    const s = series.find((x) => x.name === item.type)
    if (s) s.data.push(item.value)
    else series.push({ name: item.type, type: 'line', smooth: true, data: [item.value] })
  }
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: legend, left: '0', z: 4 },
    // top 未指定时 ECharts 5 默认 60（ECharts 6 改成了 65）
    grid: { top: 60, left: '1%', right: '1%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: dates },
    yAxis: { type: 'value' },
    series,
  }
}

/** 流量排行横向柱状图（原版 *RankChartRender，数据倒序后自下而上排列） */
function buildRankOption(rows: Array<[name: string, total: number]>): EChartOption {
  const reversed = rows.toReversed()
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => `${(params as Array<{ value: number }>)[0]?.value} GB`,
    },
    grid: { top: '1%', left: '1%', right: '1%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: reversed.map(([name]) => name) },
    series: [{ data: reversed.map(([, total]) => total), type: 'bar' }],
  }
}

