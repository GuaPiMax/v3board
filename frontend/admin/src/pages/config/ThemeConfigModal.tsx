import { Input, Modal, Select } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import type { ThemeConfigField } from '@/api/types'
import { message } from '@/app/staticApi'
import { useThemeManageStore } from '@/stores/themeManage'

interface ThemeConfigModalProps {
  /** 主题目录名 */
  keyName: string
  themeName: string
  configs?: ThemeConfigField[]
  /** 点击后打开弹窗的元素（原版用 cloneElement 覆盖它的 onClick） */
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

/** 与原版一致：JSON 按 UTF-8 编码后转 base64（btoa(unescape(encodeURIComponent(...)))） */
function toBase64(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
}

// 主题设置弹窗（原版 8drl 里的组件 m）：打开时读取该主题的设置，按 config.json 的字段显示下拉框 / 输入框 / 多行输入框；
// 与原版一致，保存成功后只提示「保存成功」、弹窗不关闭，关闭时清空表单
export function ThemeConfigModal({ keyName, themeName, configs, children }: ThemeConfigModalProps) {
  const saveThemeConfigLoading = useThemeManageStore((s) => s.saveThemeConfigLoading)
  const [params, setParams] = useState<Record<string, string>>({})
  const [visible, setVisible] = useState(false)

  const show = async () => {
    setVisible(true)
    const data = await useThemeManageStore.getState().getThemeConfig(keyName)
    if (data) setParams(data)
  }

  const hidden = () => {
    setVisible(false)
    setParams({})
  }

  const save = () =>
    void useThemeManageStore
      .getState()
      .saveThemeConfig(toBase64(params), keyName, () => message.success('保存成功'))

  const change = (name: string, value: string) => setParams((p) => ({ ...p, [name]: value }))

  const buildType = (field: ThemeConfigField) => {
    switch (field.field_type) {
      case 'select':
        return (
          <div>
            <Select<string>
              style={{ width: '100%' }}
              placeholder={field.placeholder}
              value={params[field.field_name]}
              onChange={(value) => change(field.field_name, value)}
              options={Object.keys(field.select_options ?? {}).map((key) => ({
                value: key,
                label: field.select_options?.[key],
              }))}
            />
          </div>
        )
      case 'input':
        return (
          <Input
            placeholder={field.placeholder}
            value={params[field.field_name]}
            onChange={(e) => change(field.field_name, e.target.value)}
          />
        )
      case 'textarea':
        return (
          <Input.TextArea
            rows={5}
            placeholder={field.placeholder}
            value={params[field.field_name]}
            onChange={(e) => change(field.field_name, e.target.value)}
          />
        )
      default:
        return undefined
    }
  }

  return (
    <>
      {cloneElement(children, { onClick: () => void show() })}
      <Modal
        onCancel={hidden}
        title={`配置${themeName}主题`}
        open={visible}
        okButtonProps={{ loading: saveThemeConfigLoading }}
        onOk={save}
      >
        {(configs || []).map((field) => (
          <div key={field.field_name} className="form-group">
            <label>{field.label}</label>
            {buildType(field)}
          </div>
        ))}
      </Modal>
    </>
  )
}
