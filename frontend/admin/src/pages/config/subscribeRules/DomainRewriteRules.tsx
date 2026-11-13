// 订阅域名重写规则（v3board 独有，config/fetchDomainRewriteRules）：
// 客户端 UA 包含关键词时，把节点列表里匹配的域名替换成指定 IP 下发
import { Input } from 'antd'
import { fetchDomainRewriteRules, saveDomainRewriteRules } from '@/api/services/config'
import type { DomainRewriteRule } from '@/api/types'
import { message } from '@/app/staticApi'
import { DeleteButton, EmptyRow, RulesSection, TABLE, TD, TH, useRules } from './shared'

const FIELDS: Array<[keyof DomainRewriteRule, string, string]> = [
  ['ua', 'UA 关键词', '如 Atlas/1.0'],
  ['domain', '匹配域名', '如 example.com'],
  ['ip', '替换 IP', '如 1.2.3.4'],
  ['remark', '备注', '可选'],
]

export function DomainRewriteRules() {
  const { rules, update, remove, add, submit, ...state } = useRules(fetchDomainRewriteRules, saveDomainRewriteRules)

  const save = () => {
    const bad = rules.findIndex(
      (rule) => !String(rule.ua || '').trim() || !String(rule.domain || '').trim() || !String(rule.ip || '').trim(),
    )
    if (bad !== -1) {
      message.error(`第 ${bad + 1} 条规则的 UA、域名、IP 为必填项`)
      return
    }
    void submit()
  }

  return (
    <RulesSection
      title="订阅域名重写规则"
      description="当客户端 UA 包含指定关键词时，将节点列表中匹配的域名替换为指定 IP 下发。"
      {...state}
      onAdd={() => add({ ua: '', domain: '', ip: '', remark: '' })}
      onSave={save}
    >
      <table style={TABLE}>
        <thead>
          <tr>
            {FIELDS.map(([key, title]) => (
              <th key={key} style={{ ...TH, width: '22%' }}>
                {title}
              </th>
            ))}
            <th style={{ ...TH, width: '12%', textAlign: 'center' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <EmptyRow colSpan={5} />
          ) : (
            rules.map((rule, index) => (
              <tr key={index}>
                {FIELDS.map(([key, , placeholder]) => (
                  <td key={key} style={TD}>
                    <Input
                      placeholder={placeholder}
                      value={rule[key] ?? ''}
                      onChange={(e) => update(index, { [key]: e.target.value })}
                    />
                  </td>
                ))}
                <td style={{ ...TD, textAlign: 'center' }}>
                  <DeleteButton onClick={() => remove(index)} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </RulesSection>
  )
}
