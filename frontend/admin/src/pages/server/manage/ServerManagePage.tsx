import {
  CaretDownOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FormOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Divider, Dropdown, Input, Switch, Tag, Tooltip, type TableColumnsType } from 'antd'
import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { queryKeys, useRefetch, useServerGroups, useServerNodes, useServerRoutes } from '@/api/queries'
import { copyNode, dropNode, sortNodes, updateNode } from '@/api/services/serverManage'
import type { ServerNode } from '@/api/types'
import { JsLink } from '@/components/JsLink'
import { LegacyList, LegacyListItem } from '@/components/LegacyList'
import { Loading } from '@/components/Loading'
import { DragHandle } from '@/components/table/DragHandle'
import { V2Table } from '@/components/table/V2Table'
import { useHoverMenuClose } from '@/hooks/useHoverMenuClose'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useUi } from '@/stores/appearance'
import { useServerManageStore } from '@/stores/serverManage'
import { copyText } from '@/utils/clipboard'
import { isMobile } from '@/utils/device'
import { getHabit, setHabit } from '@/utils/storage'
import { CREATE_MENU, NodeDrawer, TYPE_FILTERS, TypeTag } from './nodeTypes'
import { moveNode, toSortPayload } from './utils'

/** 运行状态 → Badge 状态 */
const STATUS: Record<number, 'error' | 'warning' | 'processing'> = { 0: 'error', 1: 'warning', 2: 'processing' }

/** 节点 ID（子节点显示为「id => 父节点 id」） */
const nodeId = (node: ServerNode) => (node.parent_id ? `${node.id} => ${node.parent_id}` : node.id)

// 原版为不带 href 的 <a>；onClick 由抽屉通过 cloneElement 传入
function EditLabel({ icon, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { icon: ReactNode }) {
  return (
    <a {...props}>
      {icon} 编辑
    </a>
  )
}

/**
 * 工具栏的「+」新建菜单（悬停展开）。开合状态放在这个组件里，不让整个页面重新渲染：
 * 与原版一样，新建抽屉只在页面重新渲染时重新创建（drawerKey 由页面传入），取消后直接再打开仍保留填写的内容
 */
function CreateNodeMenu({ drawerKey }: { drawerKey: number }) {
  const hover = useHoverMenuClose()
  return (
    <Dropdown
      {...hover}
      menu={{
        items: CREATE_MENU.map(([type, label]) => ({
          key: type,
          label: (
            <NodeDrawer type={type} key={drawerKey}>
              <a>
                <TypeTag type={type}>{label}</TypeTag>
              </a>
            </NodeDrawer>
          ),
        })),
      }}
    >
      <Button>
        <PlusOutlined />
      </Button>
    </Dropdown>
  )
}

/** 有未保存的排序时，离开页面前确认（原版 react-router Prompt + window.confirm） */
function useLeaveConfirm(when: boolean) {
  const blocker = useBlocker(when)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('节点排序还没有保存，是否离开')) blocker.proceed()
    else blocker.reset()
  }, [blocker])
}

// 节点管理（原版模块 uzXD + model serverManage 与各协议 model）
export default function ServerManagePage() {
  const queryClient = useQueryClient()
  const ui = useUi()
  const { data: nodes = [], isFetching } = useServerNodes()
  const { data: groups = [] } = useServerGroups()
  // 与原版一致：进入页面时拉取路由（编辑抽屉的路由组选项）
  useServerRoutes()
  const refetch = useRefetch(queryKeys.serverNodes)
  const { sortMode, savingSort, setSortMode, setSavingSort } = useServerManageStore()
  const [searchKey, setSearchKey] = useState<string>()
  const [pageSize, setPageSize] = useState<number>(() => getHabit<number>('server_manage_page_size') || 10)
  // 右键菜单对应的行（原版 this.record）
  const [contextRecord, setContextRecord] = useState<ServerNode | undefined>()
  const mobile = isMobile()
  useLeaveConfirm(sortMode)
  // 与原版一致（key 为 Math.random()）：新建菜单里的抽屉和右键菜单里的编辑抽屉在页面每次重新渲染时都重新创建，
  // 例如保存成功刷新列表后，下次打开新建抽屉是空白表单；右键另一行时编辑抽屉按新的行初始化。行内「操作」菜单的抽屉按节点保留
  // oxlint-disable-next-line react/purity
  const renderKey = Math.random()

  const dataSource = searchKey ? nodes.filter((node) => JSON.stringify(node).includes(searchKey)) : nodes

  // 与原版一致：成功后重新拉取列表（不等待）；删除没有确认
  const run = async (request: Promise<{ code: number }>) => {
    const res = await request
    if (res.code === 200) void refetch()
  }
  const update = (node: ServerNode, key: string, value: unknown) => void run(updateNode(node.type, node.id, key, value))
  const copy = (node: ServerNode | undefined) => node && void run(copyNode(node.type, node.id))
  const drop = (node: ServerNode | undefined) => node && void run(dropNode(node.type, node.id))

  // 拖动只改本地顺序，点「保存排序」才提交。行号来自显示的列表（可能经过搜索过滤），按节点在完整列表上移动
  const sort = (fromIndex: number, toIndex: number) =>
    queryClient.setQueryData<ServerNode[]>(queryKeys.serverNodes, (list = []) =>
      moveNode(list, dataSource, fromIndex, toIndex),
    )

  const saveSort = async () => {
    setSavingSort(true)
    const res = await sortNodes(toSortPayload(nodes))
    setSavingSort(false)
    if (res.code === 200) void refetch()
  }

  const show = (node: ServerNode) => (
    <Switch
      size="small"
      checked={Boolean(Number.parseInt(String(node.show), 10))}
      onClick={() => update(node, 'show', Number.parseInt(String(node.show), 10) ? 0 : 1)}
    />
  )

  // 行的「操作」下拉菜单（原版函数 I）
  const actions = (node: ServerNode) => (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'edit',
            label: (
              <NodeDrawer type={node.type} record={node} key={node.id}>
                <EditLabel icon={<EditOutlined />} />
              </NodeDrawer>
            ),
          },
          {
            key: 'copy',
            onClick: () => copy(node),
            label: (
              <>
                <CopyOutlined /> 复制
              </>
            ),
          },
          {
            key: 'drop',
            // 删除的红色：皮肤里取 --v2b-danger-text（见 styles/skins），legacy 下没有定义，取原值
            style: { color: 'var(--v2b-danger-text, #ff4d4f)' },
            onClick: () => drop(node),
            label: (
              <>
                <DeleteOutlined /> 删除
              </>
            ),
          },
        ],
      }}
    >
      <JsLink>
        操作 <CaretDownOutlined />
      </JsLink>
    </Dropdown>
  )

  const columns: TableColumnsType<ServerNode> = [
    {
      title: '节点ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      filters: TYPE_FILTERS.map((type) => ({ text: type, value: type })),
      onFilter: (value, node) => node.type === String(value).toLowerCase(),
      render: (_: number, node) => (
        <span>
          <TypeTag type={node.type} protocol={node.protocol}>{nodeId(node)}</TypeTag>
        </span>
      ),
    },
    { title: '显隐', dataIndex: 'show', key: 'show', render: (_: unknown, node) => show(node) },
    {
      title: (
        <span>
          <Tooltip
            placement="top"
            title={
              <div>
                <Badge status="error" /> 未运行
                <br />
                <Badge status="warning" /> 无人使用或服务端上报异常
                <br />
                <Badge status="processing" /> 运行正常
                <br />
              </div>
            }
          >
            节点 <QuestionCircleOutlined />
          </Tooltip>
        </span>
      ),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, node) => (
        <>
          <Badge status={STATUS[node.available_status]} />
          <span>{name}</span>
        </>
      ),
    },
    {
      title: '地址',
      dataIndex: 'host',
      key: 'host',
      render: (_: string, node) => (
        <span style={{ cursor: 'pointer' }} onClick={() => copyText(node.host)}>
          {`${node.host}:${node.port}`}
        </span>
      ),
    },
    {
      title: (
        <span>
          <Tooltip placement="top" title="根据服务端上报频率而定">
            人数 <QuestionCircleOutlined />
          </Tooltip>
        </span>
      ),
      dataIndex: 'online',
      key: 'online',
      align: 'left',
      width: 130,
      sorter: (a, b) => Number(a.online) - Number(b.online),
      render: (online: ServerNode['online']) => (
        <>
          <UserOutlined /> {online || 0}
        </>
      ),
    },
    {
      title: (
        <Tooltip placement="top" title="使用的流量将乘以倍率进行扣除">
          倍率 <QuestionCircleOutlined />
        </Tooltip>
      ),
      dataIndex: 'rate',
      key: 'rate',
      align: 'center',
      render: (rate: ServerNode['rate']) => <Tag style={{ minWidth: 60 }}>{`${rate} x`}</Tag>,
    },
    {
      title: '权限组',
      dataIndex: 'group_id',
      key: 'group_id',
      filters: groups.map((group) => ({ text: group.name, value: group.id })),
      // 与原版一致：按字符串匹配（后台表单保存的是字符串 id）
      onFilter: (value, node) => node.group_id.indexOf(String(value)) !== -1,
      render: (_: unknown, node) => (
        <>
          {node.group_id.map((id) => {
            const group = groups.find((g) => g.id === Number.parseInt(String(id), 10))
            return group && <Tag key={String(id)}>{group.name}</Tag>
          })}
        </>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      align: 'right',
      fixed: 'right',
      width: 100,
      render: (_: unknown, node) => <div>{actions(node)}</div>,
    },
  ]

  // 排序模式只显示排序把手、节点 ID 与名称
  const sortColumns: TableColumnsType<ServerNode> = [
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      align: 'left',
      width: 100,
      render: () => (
        <div>
          <DragHandle title="拖动排序" />
        </div>
      ),
    },
    {
      title: '节点ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (_: number, node) => (
        <span>
          <TypeTag type={node.type} protocol={node.protocol}>{nodeId(node)}</TypeTag>
        </span>
      ),
    },
    { title: '节点', dataIndex: 'name', key: 'name' },
  ]

  return (
    <AdminLayout title="节点管理">
      <Loading loading={isFetching || savingSort}>
        <div className="block block-bottom">
          <div className="bg-white">
            <div className="v2board-table-action" style={{ padding: 15 }}>
              <CreateNodeMenu drawerKey={renderKey} />
              <Input
                placeholder="输入任意关键字搜索"
                style={{ width: 200 }}
                className="ml-2"
                onChange={(e) => setSearchKey(e.target.value)}
              />
              {!mobile && (
                <Button
                  style={{ float: 'right' }}
                  type="primary"
                  onClick={() => (sortMode ? void saveSort() : setSortMode(true))}
                >
                  {sortMode ? '保存排序' : '编辑排序'}
                </Button>
              )}
            </div>
            {mobile ? (
              <LegacyList<ServerNode>
                className="v2board-table"
                dataSource={dataSource}
                rowKey={(node) => `${node.type}-${node.id}`}
                renderItem={(node) => (
                  <LegacyListItem
                    className={`v2board_node_mobile ${node.parent_id ? 'child_node' : ''}`}
                    actions={[
                      <>
                        <TypeTag type={node.type} protocol={node.protocol}>{nodeId(node)}</TypeTag>
                        <Tag>
                          <UserOutlined /> {node.online || 0}
                        </Tag>
                        <Tag>{node.rate} x</Tag>
                      </>,
                    ]}
                    extra={
                      <>
                        {show(node)}
                        <Divider orientation="vertical" />
                        <span>{actions(node)}</span>
                      </>
                    }
                    title={
                      <>
                        <Badge status={STATUS[node.available_status]} />
                        {node.name}
                      </>
                    }
                    description={`${node.host}:${node.port}`}
                  />
                )}
              />
            ) : (
              <V2Table<ServerNode>
                rowKey={(node) => `${node.type}-${node.id}`}
                dataSource={dataSource}
                columns={sortMode ? sortColumns : columns}
                pagination={
                  !sortMode && {
                    pageSize,
                    pageSizeOptions: ['10', '50', '100', '500'],
                    showSizeChanger: ui === 'legacy' ? { showSearch: false } : true,
                    onShowSizeChange: (_, size) => {
                      setPageSize(size)
                      setHabit('server_manage_page_size', size)
                    },
                  }
                }
                scroll={{ x: 1300 }}
                rowClassName={(node) => (node.parent_id ? 'child_node' : '')}
                onDragSort={sortMode ? sort : undefined}
                disableRightClick={sortMode}
                onRowContextMenu={setContextRecord}
                contextMenu={
                  <ul className="ant-dropdown-menu ant-dropdown-menu-light ant-dropdown-menu-root ant-dropdown-menu-vertical">
                    <li className="ant-dropdown-menu-item">
                      {contextRecord && (
                        <NodeDrawer type={contextRecord.type} record={contextRecord} key={renderKey}>
                          <EditLabel icon={<FormOutlined />} />
                        </NodeDrawer>
                      )}
                    </li>
                    <li onClick={() => copy(contextRecord)} className="ant-dropdown-menu-item">
                      <a>
                        <CopyOutlined /> 复制
                      </a>
                    </li>
                    <li onClick={() => drop(contextRecord)} className="ant-dropdown-menu-item">
                      <a style={{ color: 'var(--v2b-danger-text, #ff4d4f)' }}>
                        <DeleteOutlined /> 删除
                      </a>
                    </li>
                  </ul>
                }
              />
            )}
          </div>
        </div>
      </Loading>
    </AdminLayout>
  )
}
