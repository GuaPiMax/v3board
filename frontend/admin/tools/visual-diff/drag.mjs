#!/usr/bin/env node
// 拖动排序检查（新版）：订阅管理、知识库管理、支付配置、节点管理的排序模式。
//   - 拖动时行跟随鼠标上下移动（鼠标左右移动时行不动），其他行滑动让位；
//   - 拖过第一行 / 最后一行后停在两端，继续移动鼠标也不跳回原位（修正前的抽动），表格的滚动区域不被撑大；
//   - 松手后排到最后，过程中各行不闪回原来的位置；提交的排序（节点排序模式为本地顺序）与界面一致；
//   - 窗口较矮时（节点列表超出一屏）拖到底部，页面自动滚动，行仍然停在列表末尾；
//   - 节点搜索后拖动：显示的列表与完整列表都移动了拖动的节点（有意修正）。
// 会修改排序：订阅、知识库、支付配置结束后按开始前的 sort / updated_at 写回数据库；节点排序模式不保存。
// 用法：node tools/visual-diff/drag.mjs [--target new|prod] [--ui legacy|illustration|geek] [--only 名称里的文字，如 节点]
import { parseArgs } from 'node:util'
import { clickText } from './actions.mjs'
import { checkUi, launch, login, openPage, targets } from './lib.mjs'
import { sql } from './requests-user.mjs'

const { values: args } = parseArgs({
  options: { target: { type: 'string', default: 'new' }, ui: { type: 'string' }, only: { type: 'string' } },
})
checkUi(args.ui)
const base = targets[args.target]()
const token = await login()
const browser = await launch()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 与 lazy.mjs 相同：开发环境里已知的 antd 警告
const KNOWN_WARNING = /is deprecated|should not be `null`/

const TABLES = [
  { name: '订阅管理', route: '/plan', table: 'v2_plan', sort: '/plan/sort' },
  { name: '知识库管理', route: '/knowledge', table: 'v2_knowledge', sort: '/knowledge/sort' },
  { name: '支付配置', route: '/config/payment', table: 'v2_payment', sort: '/payment/sort' },
  { name: '节点管理（排序模式）', route: '/server/manage', sortMode: true },
  { name: '节点管理（排序模式，窗口高 520px，拖到底部时页面滚动）', route: '/server/manage', sortMode: true, height: 520 },
  { name: '节点管理（排序模式，搜索「香港」后拖动）', route: '/server/manage', sortMode: true, search: '香港' },
]
const SEARCH = 'input[placeholder="输入任意关键字搜索"]'

let failures = 0
function check(label, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '通过' : '失败'}  ${label}${detail ? `：${detail}` : ''}`)
}

const ROWS = '.v2b-table .ant-table-tbody > tr.ant-table-row'

/** 各行当前显示的位置（含拖动时的 transform） */
const rowRects = (page) =>
  page.$$eval(ROWS, (rows) =>
    rows.map((row) => {
      const r = row.getBoundingClientRect()
      return { key: row.dataset.rowKey, top: r.top, left: r.left, height: r.height }
    }),
  )

async function handleCenter(page, key) {
  const box = await (await page.$(`${ROWS}[data-row-key="${key}"] .anticon-menu`)).boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** 按 order 的顺序排好时各行的位置（从表体顶部依次排列） */
async function slotTops(page, order, heights) {
  const bodyTop = await page.$eval('.v2b-table .ant-table-tbody', (el) => el.getBoundingClientRect().top)
  const tops = {}
  let y = bodyTop
  for (const key of order) {
    tops[key] = y
    y += heights[key]
  }
  return tops
}

/** 各行与期望位置的最大偏差（px） */
async function maxOffset(page, expected) {
  const rects = await rowRects(page)
  return Math.max(...rects.map((r) => Math.abs(r.top - expected[r.key])))
}

/** 表格内部滚动容器是否被撑出竖向滚动区域 */
const scrollerOverflow = (page) =>
  page.$eval('.v2b-table .ant-table-content, .v2b-table .ant-table-body', (el) => el.scrollHeight - el.clientHeight)

/** 在页面里逐帧记录各行位置，返回停止并取回记录的函数 */
async function recordFrames(page) {
  await page.evaluate((selector) => {
    window.v2bFrames = []
    const tick = () => {
      window.v2bFrames.push(
        [...document.querySelectorAll(selector)].map((row) => [row.dataset.rowKey, row.getBoundingClientRect().top]),
      )
      window.v2bFrameId = requestAnimationFrame(tick)
    }
    tick()
  }, ROWS)
  return () =>
    page.evaluate(() => {
      cancelAnimationFrame(window.v2bFrameId)
      return window.v2bFrames
    })
}

function restore(table, snapshot) {
  const cases = (field) => snapshot.map((row) => `WHEN ${row.id} THEN ${row[field] ?? 'NULL'}`).join(' ')
  sql(
    `UPDATE ${table} SET sort = CASE id ${cases('sort')} END, updated_at = CASE id ${cases('updated_at')} END ` +
      `WHERE id IN (${snapshot.map((row) => row.id).join(',')})`,
  )
  const now = sql(`SELECT id, sort, updated_at FROM ${table}`)
  check('数据已恢复', JSON.stringify(now) === JSON.stringify(snapshot))
}

async function checkTable(t) {
  console.log(`== ${t.name}`)
  const snapshot = t.table && sql(`SELECT id, sort, updated_at FROM ${t.table}`)
  const page = await openPage(browser, { token, ui: args.ui, transitions: true })
  if (t.height) await page.setViewport({ width: 1440, height: t.height })
  const logs = []
  page.on('console', (m) => ['warn', 'warning', 'error'].includes(m.type()) && logs.push(m.text().slice(0, 160)))
  page.on('pageerror', (e) => logs.push(e.message.slice(0, 160)))
  // 节点排序没有保存时离开页面会弹出确认框
  page.on('dialog', (d) => void d.dismiss())
  const sorts = []
  page.on('request', (r) => {
    if (t.sort && r.method() === 'POST' && r.url().endsWith(t.sort)) sorts.push(r.postData() ?? '')
  })
  try {
    await page.goto(`${base}#${t.route}`, { waitUntil: 'networkidle0', timeout: 30000 })
    await sleep(800)
    const ui = await page.evaluate(() => document.documentElement.dataset.v2bUi)
    check('界面预设', ui === (args.ui ?? 'legacy'), ui)
    if (t.sortMode) await clickText(page, 'button', '编辑排序')
    const full = (await rowRects(page)).map((r) => r.key)
    if (t.search) {
      await page.type(SEARCH, t.search)
      await sleep(600)
    }
    const rows = await rowRects(page)
    const keys = rows.map((r) => r.key)
    const heights = Object.fromEntries(rows.map((r) => [r.key, r.height]))
    const [first, last] = [rows[0], rows.at(-1)]

    if (!t.height) {
      // 1. 最后一行往上拖过第一行：停在第一个位置，其他行下移让位；来回移动鼠标位置不变。拖回原位松手，不排序
      const from = await handleCenter(page, last.key)
      const bodyTop = await page.$eval('.v2b-table .ant-table-tbody', (el) => el.getBoundingClientRect().top)
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(from.x + 80, bodyTop - 120, { steps: 20 })
      await sleep(400)
      const up = await slotTops(page, [last.key, ...keys.slice(0, -1)], heights)
      const offsets = []
      for (const y of [bodyTop - 160, bodyTop - 90, bodyTop - 140, bodyTop - 110]) {
        await page.mouse.move(from.x + 40, y, { steps: 3 })
        await sleep(350)
        offsets.push(await maxOffset(page, up))
      }
      check('往上拖过第一行：停在第一个位置、其他行下移，来回移动不跳回', Math.max(...offsets) <= 1.5, offsets.map((o) => o.toFixed(1)).join(' / '))
      await page.mouse.move(from.x, from.y, { steps: 20 })
      await sleep(400)
      await page.mouse.up()
      await sleep(800)
      const unchanged = (await rowRects(page)).map((r) => r.key)
      check('拖回原位松手：顺序不变、没有提交排序', JSON.stringify(unchanged) === JSON.stringify(keys) && sorts.length === 0)
    }

    // 2. 第一行往下拖：跟随鼠标上下移动（鼠标同时右移 60px，行不左右移动），拖过最后一行后停在最后
    const from = await handleCenter(page, first.key)
    const body = await page.$eval('.v2b-table .ant-table-tbody', (el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom }
    })
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    const follow = []
    if (!t.height) {
      for (let dy = 10; dy <= body.bottom - first.top + 150; dy += 23) {
        await page.mouse.move(from.x + 60, from.y + dy, { steps: 3 })
        await sleep(120)
        const row = (await rowRects(page)).find((r) => r.key === first.key)
        const expected = Math.min(first.top + dy, body.bottom - first.height)
        follow.push(Math.max(Math.abs(row.top - expected), Math.abs(row.left - first.left)))
      }
      check('拖动的行跟随鼠标上下移动、不左右移动', Math.max(...follow) <= 1.5, `最大偏差 ${Math.max(...follow).toFixed(1)}px`)
    } else {
      // 窗口较矮：拖到窗口底部附近停住，页面自动滚动到底
      await page.mouse.move(from.x + 60, t.height - 15, { steps: 30 })
      await sleep(3000)
      const scroll = await page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight }))
      check('拖到窗口底部时页面自动滚动到底', scroll.y > 0 && Math.abs(scroll.y - scroll.max) <= 1, `scrollY ${scroll.y} / ${scroll.max}`)
    }
    const order = [...keys.slice(1), first.key]
    const down = await slotTops(page, order, heights)
    const offsets = []
    const positions = t.height ? [t.height - 15, t.height - 5, t.height - 25] : [150, 220, 180, 260].map((d) => body.bottom + d)
    for (const y of positions) {
      await page.mouse.move(from.x + 30, y, { steps: 3 })
      await sleep(350)
      offsets.push(await maxOffset(page, down))
    }
    check('拖过最后一行：停在最后、其他行上移，来回移动不跳回', Math.max(...offsets) <= 1.5, offsets.map((o) => o.toFixed(1)).join(' / '))
    check('表格的滚动区域没有被撑大', (await scrollerOverflow(page)) <= 1)

    // 3. 松手：各行一直停在新位置（不闪回原来的顺序），排序结果与界面一致
    const stop = await recordFrames(page)
    await page.mouse.up()
    await sleep(1500)
    const frames = await stop()
    // 每帧偏离新位置最多的行
    const worst = frames.map((frame, index) =>
      frame.reduce((acc, [key, top]) => (Math.abs(top - down[key]) > acc.offset ? { index, key, offset: Math.abs(top - down[key]) } : acc), {
        index,
        key: '',
        offset: 0,
      }),
    )
    const bad = worst.filter((w) => w.offset > 1.5)
    const flash = Math.max(...worst.map((w) => w.offset))
    check(
      `松手后各行不闪回（${frames.length} 帧）`,
      bad.length === 0,
      bad.length ? `${bad.length} 帧偏离，第 ${bad[0].index} 帧起，最大 ${flash.toFixed(1)}px（${bad.map((w) => `${w.index}:${w.key}:${w.offset.toFixed(0)}`).slice(0, 12).join(' ')}）` : '',
    )
    const after = (await rowRects(page)).map((r) => r.key)
    check('松手后第一行排到最后', JSON.stringify(after) === JSON.stringify(order), after.join(','))
    if (t.sort) {
      const ids = [...decodeURIComponent(sorts[0] ?? '').matchAll(/=(\d+)/g)].map((m) => m[1])
      check('提交的排序与界面一致', sorts.length === 1 && JSON.stringify(ids) === JSON.stringify(order), ids.join(','))
      const saved = sql(`SELECT id FROM ${t.table} ORDER BY sort`).map((row) => String(row.id))
      check('后端保存的顺序与界面一致', JSON.stringify(saved) === JSON.stringify(order), saved.join(','))
    }
    if (t.search) {
      // 在完整列表上把拖动的节点移到目标节点（显示列表的最后一行）的位置
      const expected = full.filter((key) => key !== first.key)
      expected.splice(full.indexOf(last.key), 0, first.key)
      await page.$eval(SEARCH, (el) => el.select())
      await page.keyboard.press('Backspace')
      await sleep(600)
      const all = (await rowRects(page)).map((r) => r.key)
      check('清空搜索后完整列表的顺序正确', JSON.stringify(all) === JSON.stringify(expected), all.join(','))
    }
    const unexpected = logs.filter((line) => !KNOWN_WARNING.test(line))
    check('没有报错', unexpected.length === 0, unexpected.join(' | '))
  } finally {
    await page.close()
    if (snapshot) restore(t.table, snapshot)
  }
}

console.log(`拖动排序检查：${args.target}（ui: ${args.ui ?? 'legacy'}）`)
for (const t of TABLES.filter((table) => !args.only || table.name.includes(args.only))) await checkTable(t)
await browser.close()
console.log(failures ? `\n${failures} 项失败` : '\n全部通过')
process.exit(failures ? 1 : 0)
