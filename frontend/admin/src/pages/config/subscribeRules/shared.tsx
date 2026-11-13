// 系统配置「订阅」标签页底部的两块规则表（v3board 独有）共用的部分：
//   - useRules：挂载时读取规则，表格里直接编辑，点「保存」整体提交（后端校验失败的提示由请求层弹出）
//   - RulesSection：标题 / 说明 / 加载与失败状态 / 底部「添加规则」「保存」
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { ApiResult } from '@/api/request'
import { message } from '@/app/staticApi'

export function useRules<T>(load: () => Promise<ApiResult<T[]>>, save: (rules: T[]) => Promise<ApiResult<boolean>>) {
  const [rules, setRules] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void load().then((res) => {
      if (!active) return
      if (res.code === 200) setRules(res.data ?? [])
      else setFailed(true)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [load])

  const update = (index: number, patch: Partial<T>) =>
    setRules((list) => list.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
  const remove = (index: number) => setRules((list) => list.filter((_, i) => i !== index))
  const add = (rule: T) => setRules((list) => [...list, rule])

  const submit = async () => {
    setSaving(true)
    const res = await save(rules)
    if (res.code === 200 && res.data === true) {
      message.success('保存成功')
      // 回读后端规范化后的规则（去空白、去重等），表格显示的与实际保存的一致
      const fresh = await load()
      if (fresh.code === 200) setRules(fresh.data ?? [])
    }
    setSaving(false)
  }

  return { rules, loading, failed, saving, update, remove, add, submit }
}

interface RulesSectionProps {
  title: string
  description: ReactNode
  loading: boolean
  failed: boolean
  saving: boolean
  onAdd: () => void
  onSave: () => void
  children: ReactNode
}

export function RulesSection({
  title,
  description,
  loading,
  failed,
  saving,
  onAdd,
  onSave,
  children,
}: RulesSectionProps) {
  return (
    <div style={{ padding: 20, borderBottom: '1px solid var(--v2b-line-soft, #eee)' }}>
      <div style={{ fontWeight: 'bold', marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--v2b-text-muted, #666)' }}>{description}</div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--v2b-text-muted, #999)' }}>加载中...</div>
      ) : failed ? (
        <div style={{ color: 'var(--v2b-danger-text, #ff4d4f)', padding: 12 }}>加载规则失败，请刷新页面重试</div>
      ) : (
        <>
          {children}
          <div className="d-flex" style={{ gap: 8 }}>
            <Button icon={<PlusOutlined />} onClick={onAdd}>
              添加规则
            </Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              保存
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/** 规则表格的表头 / 单元格样式 */
export const TH: CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--v2b-line-soft, #eee)',
  fontSize: 12,
  color: 'var(--v2b-text-muted, #666)',
  fontWeight: 'normal',
  textAlign: 'left',
}
export const TD: CSSProperties = { padding: '6px 12px', borderBottom: '1px solid var(--v2b-line-soft, #eee)' }
export const TABLE: CSSProperties = { width: '100%', borderCollapse: 'collapse', marginBottom: 12 }

export function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ ...TD, padding: 16, textAlign: 'center', color: 'var(--v2b-text-muted, #999)' }}>
        暂无规则，点击下方按钮添加
      </td>
    </tr>
  )
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button danger icon={<DeleteOutlined />} onClick={onClick}>
      删除
    </Button>
  )
}
