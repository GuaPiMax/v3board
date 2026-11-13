// 截图 / 请求比对共用的页面操作

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 固定列里可见的链接：antd 3 在右侧覆盖表格 .ant-table-fixed-right 里，新版 legacy 在 .v2b-fix-end-float 里
// （两者都另有一份被遮住 / 隐藏的副本在主表格里，clickText 会优先点能点到的那份）；皮肤只有一份，在固定列单元格里
export const FIXED_END_LINK = '.ant-table-fixed-right .ant-table-tbody a, .v2b-fix-end-float a, .ant-table-cell-fix-end a'

// 下拉选项：antd 3 为 li.ant-select-dropdown-menu-item，antd 6 为 .ant-select-item-option
export const SELECT_OPTION = '.ant-select-dropdown-menu-item, .ant-select-item-option'

/**
 * 点击第 nth 个（从 0 开始）文字为 text 的元素，并等待弹窗 / 抽屉动画结束。
 * 优先选择在元素中心真正能点到的元素：表格固定列在窄屏下有被遮住（antd 3 主表格里的副本）或隐藏（新版原位副本）的同名链接，
 * 点它们会让表格横向滚动或点错位置。其次选择有尺寸的元素（例如下拉列表里需要滚动才能看到的选项，puppeteer 会先滚动到可见），
 * 最后才是全部（已关闭的下拉里也有同名选项）
 */
export async function clickText(page, selector, text, nth = 0) {
  const handle = await page.waitForFunction(
    (sel, t, n) => {
      const all = [...document.querySelectorAll(sel)].filter((el) => el.textContent.trim() === t.trim())
      const sized = all.filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width && r.height
      })
      const hittable = sized.filter((el) => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return hit && (hit === el || el.contains(hit))
      })
      return (hittable.length > n ? hittable : sized.length > n ? sized : all)[n]
    },
    { timeout: 10000 },
    selector,
    text,
    nth,
  )
  await handle.asElement().click()
  // 等待弹窗 / 抽屉入场动画结束（antd 3 与 antd 6 均约 0.3s）
  await new Promise((r) => setTimeout(r, 1200))
}

// 拖动第 from 行的排序把手（menu 图标）到第 to 行（原版 react-drag-listview 与新版 dnd-kit 都响应真实的鼠标拖动）
export async function dragRow(page, from, to) {
  const handles = await page.$$('.ant-table-tbody .anticon-menu')
  const rows = await page.$$('.ant-table-tbody tr.ant-table-row')
  const a = await handles[from].boundingBox()
  const b = await rows[to].boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  const targetY = b.y + b.height / 2 + (to > from ? 10 : -10)
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(a.x + a.width / 2, a.y + ((targetY - a.y) * i) / 10)
    await sleep(40)
  }
  await page.mouse.up()
  await sleep(1500)
}

// 当前显示的弹窗 / 抽屉
export async function visibleDrawer(page) {
  for (const el of await page.$$('.ant-drawer')) {
    if (await el.evaluate((e) => e.classList.contains('ant-drawer-open'))) return el
  }
  throw new Error('没有打开的抽屉')
}
