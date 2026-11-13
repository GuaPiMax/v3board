import type { ReactNode } from 'react'
import { Loading } from './Loading'

interface TableBlockProps {
  loading?: boolean
  /** 顶部操作区（原版为 padding 15px 的 div） */
  toolbar?: ReactNode
  /**
   * 原版有两种写法：
   *   - 默认：前置一个空的 d-flex 行 + block block-rounded（公告、权限组、路由、订阅……）
   *   - bordered：block border-bottom（优惠券、礼品卡、知识库……）
   */
  bordered?: boolean
  children?: ReactNode
}

// 列表页的内容块：Loading > block > bg-white > [工具栏] + 表格
export function TableBlock({ loading, toolbar, bordered = false, children }: TableBlockProps) {
  return (
    <>
      {!bordered && <div className="d-flex justify-content-between align-items-center" />}
      <Loading loading={loading}>
        <div className={bordered ? 'block border-bottom' : 'block block-rounded'}>
          <div className="bg-white">
            {toolbar !== undefined && <div style={{ padding: 15 }}>{toolbar}</div>}
            {children}
          </div>
        </div>
      </Loading>
    </>
  )
}
