// antd 3 的纵向列表（List itemLayout="vertical"）：原版移动端节点列表使用。
// antd 6.6 起 List 已弃用（新组件 Listy 的结构不同），这里直接输出 antd 3 的 DOM，样式见 styles/_antd3-list.scss
import { Empty } from 'antd'
import { Fragment, type Key, type ReactNode } from 'react'

interface LegacyListProps<T> {
  className?: string
  dataSource: T[]
  rowKey: (item: T) => Key
  renderItem: (item: T) => ReactNode
}

export function LegacyList<T>({ className, dataSource, rowKey, renderItem }: LegacyListProps<T>) {
  return (
    <div className={['ant-list', className, 'ant-list-vertical', 'ant-list-split'].filter(Boolean).join(' ')}>
      <div className="ant-spin-nested-loading">
        <div className="ant-spin-container">
          {dataSource.length ? (
            <ul className="ant-list-items">
              {dataSource.map((item) => (
                <Fragment key={rowKey(item)}>{renderItem(item)}</Fragment>
              ))}
            </ul>
          ) : (
            <div className="ant-list-empty-text">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface LegacyListItemProps {
  className?: string
  title?: ReactNode
  description?: ReactNode
  /** 底部操作区（每项之间有分隔线） */
  actions?: ReactNode[]
  /** 右侧附加内容 */
  extra?: ReactNode
}

export function LegacyListItem({ className, title, description, actions, extra }: LegacyListItemProps) {
  return (
    <li className={className ? `ant-list-item ${className}` : 'ant-list-item'}>
      <div className="ant-list-item-main">
        <div className="ant-list-item-meta">
          <div className="ant-list-item-meta-content">
            <h4 className="ant-list-item-meta-title">{title}</h4>
            <div className="ant-list-item-meta-description">{description}</div>
          </div>
        </div>
        {actions && actions.length > 0 && (
          <ul className="ant-list-item-action">
            {actions.map((action, i) => (
              <li key={i}>
                {action}
                {i !== actions.length - 1 && <em className="ant-list-item-action-split" />}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ant-list-item-extra">{extra}</div>
    </li>
  )
}
