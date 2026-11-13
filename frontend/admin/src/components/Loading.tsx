import { Spin } from 'antd'
import type { ReactNode } from 'react'

// 原版 v32e：antd Spin + Bootstrap spinner-grow 作为加载图标
export function Loading({ loading, children }: { loading?: boolean; children?: ReactNode }) {
  return (
    <Spin spinning={Boolean(loading)} indicator={<div className="spinner-grow text-primary" />}>
      {children}
    </Spin>
  )
}
