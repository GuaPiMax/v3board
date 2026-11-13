// 服务端分页列表（优惠券、礼品卡、订单、用户……）：行为与原版 dva model 一致
//   - 请求参数为 { ...pagination, ...sort }，拿到结果后把 total 记入 pagination，之后的请求会带上 total
//   - 分页 / 排序参数在页面切换后保留；翻页时保留旧数据并显示加载中
//   - 原版翻页时会把 antd 3 分页对象的其余字段（size、pageSizeOptions、回调函数等）一并带上，新版只发有意义的字段
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TablePaginationConfig, TableProps } from 'antd'
import { ApiError, type ApiResult } from '@/api/request'
import type { PageParams } from '@/api/types'
import type { UiPreset } from '@/app/uiPreset'
import { useUi } from '@/stores/appearance'
import { DEFAULT_LIST_PARAMS, useListParams, useListParamsStore } from '@/stores/listParams'

interface PagedListOptions<T> {
  /** 列表 key（同时用作 query key 前缀与分页参数的保存位置） */
  key: string
  fetch: (params: PageParams) => Promise<ApiResult<T[]>>
  /** 对返回数据的加工（例如金额由分换算成元） */
  select?: (rows: T[]) => T[]
}

/**
 * 原版表格统一的分页配置（小尺寸、可切换每页条数）。
 * 原版传入的 pageSizeOptions 是数字，而 antd 3 选择框的值是字符串，匹配不到选项：只显示「10」而不是「10 条/页」，
 * 下拉里也没有处于选中状态的选项；legacy 预设还原这些显示（下拉选项里仍是「10 条/页」），并且不可搜索。
 * 界面预设可以在运行中切换，调用处按当前预设取（两份配置各自固定，不在每次渲染时重新生成）
 */
const LEGACY_PAGINATION = {
  size: 'small',
  showSizeChanger: {
    showSearch: false,
    labelRender: ({ value }: { value: unknown }) => String(value),
    classNames: { popup: { root: 'v2b-size-changer-unmatched' } },
  },
  pageSizeOptions: [10, 50, 100, 150],
} satisfies TablePaginationConfig
const SKIN_PAGINATION = { ...LEGACY_PAGINATION, showSizeChanger: true } satisfies TablePaginationConfig

export const paginationProps = (ui: UiPreset) => (ui === 'legacy' ? LEGACY_PAGINATION : SKIN_PAGINATION)

export function usePagedList<T>({ key, fetch, select }: PagedListOptions<T>) {
  const queryClient = useQueryClient()
  const ui = useUi()
  const [params, setParams] = useListParams(key)
  const { current, pageSize, sort_type, sort } = params

  const query = useQuery({
    // total 不参与 key：它由上一次请求写入，只是跟着参数一起发给后端
    queryKey: [key, 'list', { current, pageSize, sort_type, sort }],
    queryFn: async () => {
      const latest = useListParamsStore.getState().lists[key] ?? DEFAULT_LIST_PARAMS
      const res = await fetch(latest)
      if (res.code !== 200) throw new ApiError(res.code, res.msg)
      setParams({ total: res.total })
      const rows = res.data ?? []
      return select ? select(rows) : rows
    },
    placeholderData: keepPreviousData,
  })

  const onTableChange: NonNullable<TableProps<T>['onChange']> = (pagination, _filters, sorter) => {
    const single = Array.isArray(sorter) ? sorter[0] : sorter
    setParams({
      current: pagination.current ?? current,
      pageSize: pagination.pageSize ?? pageSize,
      sort_type: single?.order === 'ascend' ? 'ASC' : 'DESC',
      sort: single?.columnKey === undefined ? undefined : String(single.columnKey),
    })
  }

  return {
    rows: query.data ?? [],
    isFetching: query.isFetching,
    params,
    pagination: { ...paginationProps(ui), current, pageSize, total: params.total } satisfies TablePaginationConfig,
    onTableChange,
    /** 重新拉取当前页（对应原版 put({ type: 'fetch' })，原版不等待，调用处用 void） */
    refetch: () => queryClient.invalidateQueries({ queryKey: [key, 'list'] }),
  }
}
