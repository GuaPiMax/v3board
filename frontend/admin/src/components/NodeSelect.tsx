// 节点选择（可搜索）与它的下拉选项：节点列表来自 useServerNodes，值为 type:id；风控中心、订阅节点 UA 白名单规则共用
import { Select } from 'antd'
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { useServerNodes } from '@/api/queries'
import { nodeKey, typeBadge } from '@/utils/nodes'

export interface NodeOption {
  value: string
  label: ReactNode
  /** 搜索用的小写文本（名称 + 协议） */
  search: string
}

/** 全部节点的下拉选项：显示「协议 · 名称」，值为 type:id；loaded 为 false 表示节点列表还没读取到（或读取失败） */
export function useNodeOptions() {
  const nodes = useServerNodes()
  const options = useMemo<NodeOption[]>(
    () =>
      (nodes.data ?? []).map((node) => {
        const badge = typeBadge(node.type)
        return {
          value: nodeKey(node),
          label: `${badge} · ${node.name || `#${node.id}`}`,
          search: `${node.name} ${badge}`.toLowerCase(),
        }
      }),
    [nodes.data],
  )
  return { options, loading: nodes.isLoading, loaded: nodes.data !== undefined }
}

/** 下拉搜索：按「名称 + 协议」的小写文本做包含匹配 */
export const filterNodeOption = (input: string, option?: NodeOption) =>
  (option?.search ?? '').includes(input.toLowerCase().trim())

interface NodeSelectProps {
  value: string | undefined
  onChange: (key: string | undefined) => void
  style?: CSSProperties
}

/** 单选一个节点 */
export function NodeSelect({ value, onChange, style }: NodeSelectProps) {
  const { options, loading } = useNodeOptions()
  return (
    <Select<string, NodeOption>
      style={{ width: 260, ...style }}
      placeholder="选择节点"
      allowClear
      showSearch
      loading={loading}
      value={value}
      options={options}
      filterOption={filterNodeOption}
      onChange={(key) => onChange(key)}
    />
  )
}
