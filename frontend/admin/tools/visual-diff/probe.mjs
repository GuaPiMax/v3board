#!/usr/bin/env node
// 在新旧版同一页面 / 状态里执行一段表达式并打印结果（调试 DOM 结构与几何用）。
// 用法：node tools/visual-diff/probe.mjs --route /server/group [--state xxx] [--viewport mobile] --eval "document.title"
//   表达式可以返回 Promise（例如先 focus 再等待过渡结束）
import { parseArgs } from 'node:util'
import { routes } from './routes.mjs'
import { gotoRoute, launch, login, openPage, targets } from './lib.mjs'

const { values: args } = parseArgs({
  options: {
    route: { type: 'string', default: '/dashboard' },
    state: { type: 'string' },
    viewport: { type: 'string', default: 'desktop' },
    eval: { type: 'string' },
    target: { type: 'string', default: 'both' },
  },
})
const token = await login()
const browser = await launch()
const state = args.state ? routes.find((r) => r.name === args.state)?.state : undefined
for (const target of args.target === 'both' ? ['old', 'new'] : [args.target]) {
  const page = await openPage(browser, { token, viewport: args.viewport })
  await gotoRoute(page, targets[target](), args.route)
  if (state) await state(page)
  const result = await page.evaluate(async (code) => {
    // eslint-disable-next-line no-new-func
    const value = await new Function(`return (${code})`)()
    return typeof value === 'string' ? value : JSON.stringify(value, null, 1)
  }, args.eval)
  console.log(`== ${target}\n${result}`)
  await page.close()
}
await browser.close()
