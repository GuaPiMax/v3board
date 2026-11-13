// antd 3 样式的表格筛选下拉（legacy 预设）：勾选菜单 + 底部「确定 / 重置」两个链接。
// 行为与 antd 3 一致：点整行切换勾选；点击外部关闭下拉时也会应用当前勾选
import { Checkbox, type TableColumnType } from 'antd'
import type { FilterDropdownProps } from 'antd/es/table/interface'
import { useEffect, useRef, type Key } from 'react'

function LegacyFilterDropdown({ filters = [], selectedKeys, setSelectedKeys, confirm, clearFilters, visible }: FilterDropdownProps) {
  const wasVisible = useRef(visible)
  useEffect(() => {
    if (wasVisible.current && !visible) confirm({ closeDropdown: false })
    wasVisible.current = visible
  }, [visible, confirm])

  const toggle = (value: Key) =>
    setSelectedKeys(selectedKeys.includes(value) ? selectedKeys.filter((key) => key !== value) : [...selectedKeys, value])

  return (
    <>
      <ul className="ant-dropdown-menu ant-dropdown-menu-without-submenu ant-dropdown-menu-root ant-dropdown-menu-vertical" role="menu">
        {filters.map((filter) => {
          const value = filter.value as Key
          const selected = selectedKeys.includes(value)
          return (
            <li
              key={String(value)}
              className={selected ? 'ant-dropdown-menu-item ant-dropdown-menu-item-selected' : 'ant-dropdown-menu-item'}
              role="menuitem"
              onClick={() => toggle(value)}
            >
              <Checkbox checked={selected} />
              <span>{filter.text}</span>
            </li>
          )
        })}
      </ul>
      <div className="ant-table-filter-dropdown-btns">
        <a className="ant-table-filter-dropdown-link confirm" onClick={() => confirm()}>
          确定
        </a>
        <a
          className="ant-table-filter-dropdown-link clear"
          onClick={() => {
            clearFilters?.({ confirm: true })
          }}
        >
          重置
        </a>
      </div>
    </>
  )
}

/** 带 filters 的列改用 antd 3 样式的筛选下拉 */
export function withLegacyFilter<T>(column: TableColumnType<T>): TableColumnType<T> {
  if (!column.filters || column.filterDropdown) return column
  return { ...column, filterDropdown: (props) => <LegacyFilterDropdown {...props} /> }
}
