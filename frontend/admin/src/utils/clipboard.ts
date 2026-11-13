import copy from 'copy-to-clipboard'
import { message } from '@/app/staticApi'

/** 复制并提示（与原版一致） */
export function copyText(text: string) {
  copy(text)
  message.success('复制成功')
}
