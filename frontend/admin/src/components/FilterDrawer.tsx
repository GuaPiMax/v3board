// 过滤器抽屉（原版模块 hVla，用户管理与订单管理共用）：
//   - 打开时复制页面当前的条件，抽屉里的添加 / 修改 / 删除只作用于这份副本，点「检索」才生效，「取消」丢弃修改
//   - 每个条件的「条件」下拉按本行的字段显示选项；输入框是受控的，删除条件后各行显示各自的内容
//   - 「检索」时每个空内容各提示一次「欲检索内容不能为空」
// 原版直接修改页面的条件数组（取消后修改仍然生效）、所有行共用最后改动那一行的条件选项、删除条件后输入框错位，
// 新版有意修正了这几处
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, DatePicker, Divider, Drawer, Input, Select } from 'antd'
import dayjs from 'dayjs'
import { cloneElement, Fragment, useState, type MouseEventHandler, type ReactElement } from 'react'
import type { FilterCondition } from '@/api/types'
import { notification } from '@/app/staticApi'

export interface FilterKey {
  key: string
  title: string
  condition: string[]
  /** 默认为文本输入 */
  type?: 'select' | 'date'
  options?: Array<{ key: string; value: string | number }>
}

interface FilterDrawerProps {
  keys: FilterKey[]
  value: FilterCondition[]
  onOk: (filter: FilterCondition[]) => void
  /** 点击后打开抽屉的元素（原版用 cloneElement 覆盖它的 onClick） */
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

/** 抽屉里编辑的条件：id 用作 React key，删除前面的条件后后面各行保持各自的输入框 */
interface DraftCondition extends FilterCondition {
  id: number
}

let lastId = 0
const withId = (condition: FilterCondition): DraftCondition => ({ ...condition, id: ++lastId })

/** 下拉的当前值：页面跳转时追加的条件值是字符串（如订单状态 '3'），按字符串匹配选项 */
function selectValue(field: FilterKey, value: unknown) {
  const option = field.options?.find((o) => String(o.value) === String(value))
  if (option) return option.value
  return value === '' || value === null || value === undefined ? undefined : (value as string | number)
}

export function FilterDrawer({ keys, value, onOk, children }: FilterDrawerProps) {
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState<DraftCondition[]>([])

  const open = () => {
    setDraft((value || []).map(withId))
    setVisible(true)
  }

  const add = () => setDraft((list) => [...list, withId({ key: keys[0].key, condition: keys[0].condition[0], value: '' })])

  const update = (id: number, patch: Partial<FilterCondition>) =>
    setDraft((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const remove = (id: number) => setDraft((list) => list.filter((item) => item.id !== id))

  const submit = (list: DraftCondition[]) => {
    let ok = true
    list.forEach((item) => {
      if (item.value === '') {
        notification.error({ title: '过滤器', description: '欲检索内容不能为空', duration: 1.5 })
        ok = false
      }
    })
    if (!ok) return
    onOk(list.map(({ id: _id, ...condition }) => condition))
    setVisible(false)
  }

  const reset = () => {
    setDraft([])
    submit([])
  }

  return (
    <>
      {cloneElement(children, { onClick: open })}
      {/* 层级固定为 antd 3 的 1000：用户管理的过滤器按钮在 Tips 提示里，antd 6 会把提示里的弹层抬到提示之上 */}
      <Drawer
        title="过滤器"
        open={visible}
        onClose={() => setVisible(false)}
        rootClassName="v2board-filter-drawer"
        size={256}
        zIndex={1000}
      >
        {draft.map((item, index) => {
          const field = keys.find((k) => k.key === item.key)
          return (
            <Fragment key={item.id}>
              <Divider>
                {/* 删除图标的红色：皮肤里取 --v2b-danger-text（见 styles/skins），legacy 下没有定义，取原值 */}
                {`条件${index + 1}`}{' '}
                <DeleteOutlined style={{ color: 'var(--v2b-danger-text, #ff4d4f)' }} onClick={() => remove(item.id)} />
              </Divider>
              <div className="form-group">
                <label>字段名</label>
                <div>
                  {/* 原版每个选项各自处理点击（重新选同一个字段也会把条件重置为第一个），这里用 onSelect */}
                  <Select<string>
                    value={item.key}
                    style={{ width: '100%' }}
                    options={keys.map((k) => ({ value: k.key, label: k.title }))}
                    onSelect={(next) => {
                      const nextField = keys.find((k) => k.key === next) ?? keys[0]
                      update(item.id, { key: nextField.key, condition: nextField.condition[0] })
                    }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>条件</label>
                <div>
                  <Select<string>
                    value={item.condition}
                    style={{ width: '100%' }}
                    options={(field ?? keys[0]).condition.map((c) => ({ value: c, label: c }))}
                    onChange={(next) => update(item.id, { condition: next })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>欲检索内容</label>
                <div>
                  {field?.type === 'select' && (
                    <Select<string | number>
                      value={selectValue(field, item.value)}
                      style={{ width: '100%' }}
                      placeholder="请选择值"
                      options={(field.options ?? []).map((o) => ({ value: o.value, label: o.key }))}
                      onChange={(next) => update(item.id, { value: next })}
                    />
                  )}
                  {field?.type === 'date' && (
                    <DatePicker
                      value={item.value ? dayjs.unix(Number(item.value)) : null}
                      style={{ width: '100%' }}
                      showTime={{ defaultOpenValue: dayjs().startOf('day') }}
                      onChange={(date) => update(item.id, { value: date && String(date.unix()) })}
                    />
                  )}
                  {field?.type === undefined && (
                    <Input
                      value={item.value === null || item.value === undefined ? '' : String(item.value)}
                      style={{ width: '100%' }}
                      placeholder="值"
                      onChange={(e) => update(item.id, { value: e.target.value })}
                    />
                  )}
                </div>
              </div>
            </Fragment>
          )
        })}
        <Button style={{ width: '100%' }} type="primary" icon={<PlusOutlined />} onClick={add}>
          添加条件
        </Button>
        <div className="v2board-drawer-action">
          {/* 原版 type="danger"：antd 3.26 为实心红色按钮 */}
          <Button disabled={!draft.length} type="primary" danger onClick={reset} style={{ float: 'left' }}>
            重置
          </Button>
          <Button style={{ marginRight: 8 }} onClick={() => setVisible(false)}>
            取消
          </Button>
          <Button disabled={!draft.length} onClick={() => submit(draft)} type="primary">
            检索
          </Button>
        </div>
      </Drawer>
    </>
  )
}
