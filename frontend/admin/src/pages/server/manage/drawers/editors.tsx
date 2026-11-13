// 子抽屉里的 JSON 编辑器：传输协议配置（#v2ray-protocol）与 AnyTLS 填充方案（#anytls-padding-scheme）
import { LinkOutlined } from '@ant-design/icons'
import { CodeEditor } from '@/components/CodeEditor'

// 与原版相同的编辑器参数。原版还传了 enableBasicAutocompletion / enableLiveAutocompletion / enableSnippets: false，
// 这几项需要 ace 的 language_tools 扩展才认识（否则控制台警告），值与默认相同，这里省略
const EDITOR_PROPS = {
  fontSize: 14,
  showPrintMargin: true,
  showGutter: true,
  highlightActiveLine: true,
  setOptions: {
    showLineNumbers: true,
    tabSize: 2,
  },
}

/** 编辑器的值：原版直接传入 state 里的值（正常情况下是 JSON 文本） */
const editorValue = (value: unknown) => (typeof value === 'string' ? value : '')

/** 各传输协议的示例配置（编辑器为空时显示为占位文字） */
export type NetworkPlaceholders = Record<string, string>

export const json4 = (value: unknown) => JSON.stringify(value, null, 4)

export function NetworkSettingsEditor({
  placeholders,
  network,
  value,
  onChange,
}: {
  placeholders: NetworkPlaceholders
  network: unknown
  value: unknown
  onChange: (value: string) => void
}) {
  return (
    <div id="v2ray-protocol">
      <div className="form-group">
        <label>
          协议详细配置
          <a href="https://www.v2ray.com/chapter_02/05_transport.html">
            <LinkOutlined />
            参考
          </a>
        </label>
        <CodeEditor
          placeholder={placeholders[network as string] || ''}
          value={editorValue(value) || ''}
          onChange={onChange}
          {...EDITOR_PROPS}
        />
      </div>
    </div>
  )
}

/** AnyTLS 默认填充方案（编辑器为空时的占位文字） */
const DEFAULT_PADDING_SCHEME = json4([
  'stop=8',
  '0=30-30',
  '1=100-400',
  '2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000',
  '3=9-9,500-1000',
  '4=500-1000',
  '5=500-1000',
  '6=500-1000',
  '7=500-1000',
])

export function PaddingSchemeEditor({ value, onChange }: { value: unknown; onChange: (value: string) => void }) {
  return (
    <div id="anytls-padding-scheme">
      <div className="form-group">
        <CodeEditor placeholder={DEFAULT_PADDING_SCHEME} value={editorValue(value) || ''} onChange={onChange} {...EDITOR_PROPS} />
      </div>
    </div>
  )
}
