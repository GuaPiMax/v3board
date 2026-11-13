// 节点管理（/server/manage）的请求一致性场景：新旧版执行同样的操作，比对发往后端的请求。
// 依赖 v2b-demo 的演示节点（行顺序见 routes-server.mjs），会真实创建 / 修改 / 删除节点：
// 新建和复制出来的节点在场景结束前删除，排序改动后恢复原顺序，编辑只是原样提交。
import { clickText, dragRow, SELECT_OPTION } from './actions.mjs'
import { config } from './lib.mjs'
import { NODE_ROWS, OPEN_DROPDOWN, openCreate, openEdit, rightClickRow, ROW_ACTION_LINK } from './routes-server.mjs'

const ROUTE = '/server/manage'
const ADMIN_API = `${config.apiOrigin}/api/v1/${config.securePath}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 最上层（最后打开）的抽屉 */
async function topDrawer(page) {
  const drawers = []
  for (const el of await page.$$('.ant-drawer.ant-drawer-open')) drawers.push(el)
  if (!drawers.length) throw new Error('没有打开的抽屉')
  return drawers.at(-1)
}

/** 最上层抽屉里标签以 label 开头的表单项 */
async function field(page, label) {
  const drawer = await topDrawer(page)
  for (const group of await drawer.$$('.form-group')) {
    const text = await group.evaluate((el) => el.querySelector(':scope > label')?.textContent.trim() ?? '')
    if (text.startsWith(label)) return group
  }
  throw new Error(`没有找到表单项「${label}」`)
}

/** 在表单项的输入框里输入（先全选删除原有内容：三击在中文内容上不一定能选中整段） */
async function fill(page, label, value) {
  const input = await (await field(page, label)).$('input.ant-input, textarea')
  await input.click()
  await input.evaluate((el) => el.select())
  await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
}

/** 选择表单项里的下拉选项 */
async function choose(page, label, option) {
  await (await (await field(page, label)).$('.ant-select')).click()
  await sleep(400)
  await clickText(page, SELECT_OPTION, option)
  await sleep(300)
}

/** 多选 / 标签框：依次选择（或输入后回车） */
async function pick(page, label, values, { type = false } = {}) {
  const select = await (await field(page, label)).$('.ant-select')
  await select.click()
  await sleep(300)
  for (const value of values) {
    if (type) {
      await page.keyboard.type(value)
      await page.keyboard.press('Enter')
    } else {
      await clickText(page, SELECT_OPTION, value)
    }
    await sleep(200)
  }
  await page.keyboard.press('Escape')
  await sleep(300)
}

/** 设置子抽屉里 ace 编辑器的内容（直接调用 ace，避免自动补全括号） */
async function setEditor(page, text) {
  await page.evaluate((value) => {
    const editors = [...document.querySelectorAll('.ace_editor')]
    editors.at(-1).env.editor.setValue(value, 1)
  }, text)
  await sleep(300)
}

/** 打开子抽屉（label 为表单项标签，点其中的「编辑配置」等链接） */
async function openChild(page, label) {
  const link = await (await field(page, label)).$('a')
  await link.click()
  await sleep(1000)
}

/** 关闭最上层的子抽屉（点遮罩） */
async function closeChild(page) {
  await page.mouse.click(40, 400)
  await sleep(1000)
}

async function submit(page) {
  await (await (await topDrawer(page)).$('.v2board-drawer-action .ant-btn-primary')).click()
  await sleep(2000)
}

/** 名称为 name 的行的序号（主表格） */
async function rowIndexOf(page, name) {
  return page.evaluate((text) => {
    const rows = [...document.querySelectorAll('.ant-table-scroll .ant-table-tbody tr.ant-table-row, .ant-table-content .ant-table-tbody tr.ant-table-row')]
    return rows.findIndex((row) => [...row.querySelectorAll('td')].some((td) => td.textContent.trim() === text))
  }, name)
}

/** 行内「操作」菜单里的某一项（复制 / 删除） */
async function rowAction(page, index, item) {
  await clickText(page, ROW_ACTION_LINK, '操作', index)
  await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, item)
  await sleep(1500)
}

/** 新建节点的公共部分：名称、倍率保持默认、权限组、地址、端口 */
async function fillBasics(page, target, { host = 'req.example.com', port = '443', serverPort = '8443' } = {}) {
  await fill(page, '节点名称', `请求比对-${target}`)
  await pick(page, '节点标签', ['比对'], { type: true })
  await pick(page, '权限组', ['默认组', '专线组'])
  const hostLabel = (await (await topDrawer(page)).$$eval('.form-group > label', (ls) => ls.map((l) => l.textContent.trim()))).find(
    (t) => t === '节点地址' || t === '连接地址',
  )
  await fill(page, hostLabel, host)
  await fill(page, '连接端口', port)
  await fill(page, '服务端口', serverPort)
}

/** 新建后删除：按名称找到刚创建的行 */
async function dropCreated(page, target) {
  const index = await rowIndexOf(page, `请求比对-${target}`)
  if (index < 0) throw new Error('没有找到新建的节点')
  await rowAction(page, index, '删除')
}

const editScenarios = Object.fromEntries(
  Object.keys(NODE_ROWS).map((type) => [
    `server-manage-edit-save-${type}`,
    {
      route: ROUTE,
      run: async (page) => {
        await openEdit(page, type)
        await submit(page)
      },
    },
  ]),
)

const createScenarios = {
  'server-manage-create-shadowsocks': async (page, target) => {
    await fillBasics(page, target)
    await choose(page, '加密算法', '2022-blake3-aes-256-gcm')
    await choose(page, '混淆', 'HTTP')
    const inputs = await (await field(page, '混淆')).$$('input.ant-input')
    await inputs[0].click()
    await page.keyboard.type('/obfs')
    await inputs[1].click()
    await page.keyboard.type('obfs.example.com')
    await choose(page, '父节点', '香港 01')
    await pick(page, '路由组', ['屏蔽广告'])
  },
  'server-manage-create-vmess': async (page, target) => {
    await fillBasics(page, target)
    await choose(page, 'TLS', '支持')
    await openChild(page, 'TLS')
    await fill(page, 'Server Name', 'tls.example.com')
    await (await (await field(page, 'Allow Insecure')).$('.ant-switch')).click()
    await closeChild(page)
    await choose(page, '传输协议', 'WebSocket')
    await openChild(page, '传输协议')
    await setEditor(page, '{\n  "path": "/ws",\n  "headers": { "Host": "ws.example.com" }\n}')
    await closeChild(page)
  },
  'server-manage-create-trojan': async (page, target) => {
    await fillBasics(page, target)
    await choose(page, '允许不安全', '是')
    await fill(page, '服务器名称指示', 'sni.example.com')
    await choose(page, '传输协议', 'gRPC')
    await openChild(page, '传输协议')
    await setEditor(page, '{"serviceName":"grpc"}')
    await closeChild(page)
  },
  'server-manage-create-vless': async (page, target) => {
    await fillBasics(page, target)
    await choose(page, '安全性', 'Reality')
    await openChild(page, '安全性')
    await fill(page, 'Server Name(SNI)', 'www.example.com')
    await fill(page, 'Server Port', '443')
    await choose(page, 'Proxy Protocol', '1')
    await choose(page, 'FingerPrint', 'Safari')
    await closeChild(page)
    await choose(page, '传输协议', 'TCP')
    await choose(page, '加密方式', 'MLKEM768X25519PLUS')
    // 只打开加密配置不修改：原版一打开就把默认配置写回节点
    await openChild(page, '加密方式')
    await closeChild(page)
    await choose(page, 'XTLS流控算法', 'xtls-rprx-vision')
  },
  'server-manage-create-hysteria': async (page, target) => {
    await fillBasics(page, target)
    await choose(page, 'HYSTERIA版本', 'v2')
    await choose(page, '混淆方式obfs', 'salamander')
    await fill(page, '混淆密码obfs_password', 'secret')
    await fill(page, '上行带宽', '100')
    await fill(page, '下行带宽', '200')
  },
  'server-manage-create-tuic': async (page, target) => {
    await fillBasics(page, target)
    await choose(page, '禁用SNI', '是')
    await choose(page, '数据包中继模式', 'quic')
    await choose(page, '拥塞控制算法', 'bbr')
    await choose(page, '客户端启用 0-RTT', '是')
  },
  'server-manage-create-anytls': async (page, target) => {
    await fillBasics(page, target)
    await openChild(page, '编辑填充方案')
    await setEditor(page, '["stop=8","0=30-30"]')
    await closeChild(page)
  },
  'server-manage-create-v2node': async (page, target) => {
    await fillBasics(page, target)
    await fill(page, '监听地址', '0.0.0.0')
    // 切到 Trojan 时安全性自动改为 TLS
    await choose(page, '节点协议', 'Trojan')
    await choose(page, '传输协议', 'WebSocket')
    await pick(page, '信任的XFF头部', ['X-Real-IP'], { type: true })
    await openChild(page, '安全性')
    await choose(page, '证书模式Cert Mode', 'DNS申请')
    await fill(page, 'DNS解析提供商Provider', 'cloudflare')
    await fill(page, 'DNS env', 'CF_DNS_API_TOKEN=x')
    await closeChild(page)
    await openChild(page, '传输协议')
    await setEditor(page, '{"path":"/v2node","acceptProxyProtocol":true}')
    await closeChild(page)
  },
  'server-manage-create-v2node-shadowsocks': async (page, target) => {
    await fillBasics(page, target)
    await choose(page, '节点协议', 'Shadowsocks')
    await choose(page, '加密算法', 'chacha20-ietf-poly1305')
  },
}

export const serverManageScenarios = {
  'server-manage-list': { route: ROUTE },
  'server-manage-toggle': {
    route: ROUTE,
    run: async (page) => {
      for (let i = 0; i < 2; i++) {
        const switches = await page.$$('.ant-table-tbody .ant-switch')
        await switches[2].click()
        await sleep(1500)
      }
    },
  },
  'server-manage-copy-drop': {
    route: ROUTE,
    run: async (page) => {
      await rowAction(page, NODE_ROWS.trojan, '复制')
      await sleep(500)
      // 复制出来的节点排在原节点之后，且处于隐藏状态
      await rowAction(page, NODE_ROWS.trojan + 1, '删除')
    },
  },
  ...editScenarios,
  ...Object.fromEntries(
    Object.entries(createScenarios).map(([name, fillForm]) => [
      name,
      {
        route: ROUTE,
        run: async (page, target) => {
          const type = name.replace('server-manage-create-', '').replace('-shadowsocks', '')
          await openCreate(page, type)
          await fillForm(page, target)
          await submit(page)
          await dropCreated(page, target)
        },
      },
    ]),
  ),
  'server-manage-sort': {
    route: ROUTE,
    // 保存排序会把 sort 改写为列表位置（0、1、2……），结束后恢复原来的值
    before: async (token) => {
      const res = await fetch(`${ADMIN_API}/server/manage/getNodes`, { headers: { authorization: token } })
      const payload = {}
      for (const node of (await res.json()).data) (payload[node.type] ??= {})[node.id] = node.sort
      return payload
    },
    after: async (token, payload) => {
      await fetch(`${ADMIN_API}/server/manage/sort`, {
        method: 'POST',
        headers: { authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    run: async (page) => {
      for (const [from, to] of [
        [0, 2],
        [2, 0],
      ]) {
        await clickText(page, 'button', '编辑排序')
        await dragRow(page, from, to)
        await clickText(page, 'button', '保存排序')
        await sleep(1500)
      }
    },
  },
  'server-manage-context-edit': {
    route: ROUTE,
    run: async (page) => {
      await rightClickRow(page, NODE_ROWS.vless)
      await clickText(page, '#v2board-table-dropdown a', '编辑')
      await submit(page)
    },
  },
  'server-manage-context-copy-drop': {
    route: ROUTE,
    run: async (page) => {
      await rightClickRow(page, NODE_ROWS.tuic)
      await clickText(page, '#v2board-table-dropdown a', '复制')
      await sleep(1500)
      await rightClickRow(page, NODE_ROWS.tuic + 1)
      await clickText(page, '#v2board-table-dropdown a', '删除')
      await sleep(1500)
    },
  },
  // 保存失败（名称为空）后改正再提交。有意修正：原版第二次提交的传输协议配置是 false（后端报格式错误），
  // 新版提交原来的配置（保存成功）；除这一项外请求逐字一致
  'server-manage-save-invalid-retry': {
    route: ROUTE,
    fixOld: (req) =>
      req.replace('&networkSettings=false&', '&networkSettings[path]=%2Fv2ray&networkSettings[headers][Host]=jp01.example.com&'),
    run: async (page) => {
      await openEdit(page, 'vmess')
      await fill(page, '节点名称', '')
      await submit(page)
      await fill(page, '节点名称', '日本 01')
      await submit(page)
    },
  },
}
