// 订阅节点 UA 白名单规则（v3board 独有，config/fetchSubscribeNodeWhitelistRules）：
// 规则里出现过的节点变成「受限节点」，只对 UA 命中关键词的客户端下发；节点用 type:id 标识（各协议的 id 互相独立）
import { Input, Select } from 'antd'
import { fetchSubscribeNodeWhitelistRules, saveSubscribeNodeWhitelistRules } from '@/api/services/config'
import type { NodeWhitelistRule } from '@/api/types'
import { message } from '@/app/staticApi'
import { filterNodeOption, useNodeOptions, type NodeOption } from '@/components/NodeSelect'
import { nodeKey, parseNodeKey, typeBadge } from '@/utils/nodes'
import { DeleteButton, EmptyRow, RulesSection, TABLE, TD, TH, useRules } from './shared'

type RuleNode = NodeWhitelistRule['nodes'][number]

export function NodeWhitelistRules() {
  const { rules, update, remove, add, submit, ...state } = useRules(
    fetchSubscribeNodeWhitelistRules,
    saveSubscribeNodeWhitelistRules,
  )
  const { options, loading, loaded } = useNodeOptions()

  /** 规则里选中、但节点列表里已不存在的节点：红色标出，仍可移除 */
  const withStale = (selected: RuleNode[]) => {
    // 节点列表还没加载到（或加载失败）：按规则里记录的类型与 id 显示，仍可移除
    if (!loaded) {
      return selected.map((node): NodeOption => ({
        value: nodeKey(node),
        label: `${typeBadge(node.type)} · #${node.id}`,
        search: '',
      }))
    }
    const known = new Set(options.map((o) => o.value))
    const stale = selected.filter((node) => !known.has(nodeKey(node)))
    if (!stale.length) return options
    return [
      ...options,
      ...stale.map((node): NodeOption => ({
        value: nodeKey(node),
        label: (
          <span style={{ color: 'var(--v2b-danger-text, #ff4d4f)' }} title="该节点已被删除，请移除并保存">
            {typeBadge(node.type)} · #{node.id}（已删除）
          </span>
        ),
        search: '',
      })),
    ]
  }

  const save = () => {
    for (const [index, rule] of rules.entries()) {
      if (!String(rule.ua || '').trim()) {
        message.error(`第 ${index + 1} 条规则的 UA 关键词不能为空`)
        return
      }
      if (!rule.nodes || rule.nodes.length === 0) {
        message.error(`第 ${index + 1} 条规则未选择任何节点`)
        return
      }
    }
    void submit()
  }

  return (
    <RulesSection
      title="订阅节点 UA 白名单规则"
      description="规则中出现过的节点变为“受限节点”，仅对 UA 命中对应关键词的客户端下发；未出现在任何规则中的节点对所有客户端正常下发。"
      {...state}
      onAdd={() => add({ ua: '', nodes: [], remark: '' })}
      onSave={save}
    >
      <table style={{ ...TABLE, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: '22%' }}>UA 关键词</th>
            <th style={{ ...TH, width: '42%' }}>允许下发的节点（可多选）</th>
            <th style={{ ...TH, width: '22%' }}>备注</th>
            <th style={{ ...TH, width: '14%', textAlign: 'center' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <EmptyRow colSpan={4} />
          ) : (
            rules.map((rule, index) => {
              const selected = Array.isArray(rule.nodes) ? rule.nodes : []
              return (
                <tr key={index} style={{ verticalAlign: 'top' }}>
                  <td style={TD}>
                    <Input
                      placeholder="如 Stash/2."
                      value={rule.ua ?? ''}
                      onChange={(e) => update(index, { ua: e.target.value })}
                    />
                  </td>
                  <td style={TD}>
                    <Select<string[], NodeOption>
                      mode="multiple"
                      style={{ width: '100%' }}
                      placeholder="点击选择节点"
                      loading={loading}
                      showSearch
                      value={selected.map(nodeKey)}
                      options={withStale(selected)}
                      filterOption={filterNodeOption}
                      onChange={(keys) => update(index, { nodes: keys.map(parseNodeKey) })}
                    />
                  </td>
                  <td style={TD}>
                    <Input
                      placeholder="可选"
                      value={rule.remark ?? ''}
                      onChange={(e) => update(index, { remark: e.target.value })}
                    />
                  </td>
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <DeleteButton onClick={() => remove(index)} />
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </RulesSection>
  )
}
