import { LoadingOutlined } from '@ant-design/icons'
import { useIsFetching } from '@tanstack/react-query'
import { Input, Modal } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { queryKeys, useRefetch } from '@/api/queries'
import { saveServerGroup } from '@/api/services/serverGroup'
import type { ServerGroup } from '@/api/types'
import { FormGroup } from '@/components/FormGroup'

interface GroupModalProps {
  record?: ServerGroup
  /** 点击后打开弹窗的元素（原版用 cloneElement 覆盖它的 onClick） */
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

// 创建 / 编辑权限组弹窗（原版模块 8zNj，权限组页面和订阅抽屉里的「添加权限组」共用）。
// 与原版一致：表单内容只在组件创建时从 record 初始化，关闭或保存后不会重置。
export function GroupModal({ record, children }: GroupModalProps) {
  const [visible, setVisible] = useState(false)
  const [submit, setSubmit] = useState<Partial<ServerGroup>>(() => ({ ...record }))
  const loading = useIsFetching({ queryKey: queryKeys.serverGroups }) > 0
  const refetch = useRefetch(queryKeys.serverGroups)

  const save = async () => {
    const res = await saveServerGroup({ ...submit })
    if (res.code !== 200) return
    void refetch()
    setVisible(false)
  }

  return (
    <>
      {cloneElement(children, { onClick: () => setVisible(true) })}
      <Modal
        title={submit.id ? '编辑组' : '创建组'}
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => loading || void save()}
        okText={loading ? <LoadingOutlined /> : '提交'}
        cancelText="取消"
      >
        <div>
          <FormGroup label="组名">
            <Input
              placeholder="请输入组名"
              value={submit.name}
              onChange={(e) => setSubmit({ ...submit, name: e.target.value })}
            />
          </FormGroup>
        </div>
      </Modal>
    </>
  )
}
