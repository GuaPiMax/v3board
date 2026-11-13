import { Tag } from 'antd'
import { copyText } from '@/utils/clipboard'

// 点击复制的标签（原版券码 / 卡密列）
export function CopyTag({ text }: { text: string }) {
  return (
    <Tag style={{ cursor: 'pointer' }} onClick={() => copyText(text)}>
      {text}
    </Tag>
  )
}
