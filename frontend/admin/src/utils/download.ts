import dayjs from 'dayjs'
import type { ApiResult } from '@/api/request'
import { notification } from '@/app/staticApi'

/** 把接口返回的文件内容保存为本地文件（与原版一致：Blob + 隐藏的 a 标签） */
export function downloadBuffer(buffer: ArrayBuffer | undefined, filename: string) {
  const blob = new Blob([buffer ?? new ArrayBuffer(0)], { type: 'text/plain,charset=UTF-8' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.style.display = 'none'
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

/** 保存前端生成的文本文件（与 downloadBuffer 相同的方式，字符串按 UTF-8 写入） */
export function downloadText(text: string, filename: string) {
  downloadBuffer(new TextEncoder().encode(text).buffer, filename)
}

/** 原版导出文件名：<前缀> YYYY-MM-DD HH:mm:ss.csv */
export const csvFilename = (prefix: string) => `${prefix} ${dayjs().format('YYYY-MM-DD HH:mm:ss')}.csv`

/**
 * 新建 / 批量生成（优惠券、礼品卡）的结果处理：批量生成时下载后端返回的 CSV。
 * 前后端分离部署时，CSV 超过后端 PHP output_buffering 会丢失跨域响应头，浏览器拿不到响应：
 * 这时数据多半已经生成，提示后按成功处理（刷新列表、关闭弹窗）。返回 false 表示失败（提示已由请求层弹出）。
 */
export function handleGenerateResult(res: ApiResult, { batch, prefix, noun }: { batch: boolean; prefix: string; noun: string }) {
  if (res.code === 200) {
    if (batch) downloadBuffer(res.buffer, csvFilename(prefix))
    return true
  }
  if (batch && res.networkError) {
    notification.error({
      title: '无法下载 CSV',
      description: `${noun}可能已经生成，但浏览器因跨域限制拿不到 CSV 文件。列表已刷新，请确认；同域部署可以避免这个问题。`,
      duration: 8,
    })
    return true
  }
  return false
}
