// JSON 代码编辑器（原版节点配置使用 react-ace：json 模式、github 主题）。
// 其余属性（尺寸默认 500×500、字号、tabSize 等）与 react-ace 默认值一致，由调用方按原版传入。
// 皮肤的暗色版换成暗色的 tomorrow_night 主题（legacy 的暗黑模式由 darkreader 转换）
import ace from 'ace-builds/src-noconflict/ace'
import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/theme-github'
import 'ace-builds/src-noconflict/theme-tomorrow_night'
import jsonWorkerUrl from 'ace-builds/src-noconflict/worker-json?url'
import AceEditor, { type IAceEditorProps } from 'react-ace'
import { useSkinDark } from '@/utils/darkMode'

// 语法检查 worker 由 Vite 以静态资源形式提供（否则 ace 会去站点根目录找 worker-json.js）
ace.config.setModuleUrl('ace/mode/json_worker', jsonWorkerUrl)

export function CodeEditor(props: IAceEditorProps) {
  const dark = useSkinDark()
  return <AceEditor mode="json" theme={dark ? 'tomorrow_night' : 'github'} {...props} />
}
