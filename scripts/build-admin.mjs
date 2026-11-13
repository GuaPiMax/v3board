import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'frontend/admin')
const dest = path.join(root, 'public/assets/admin')
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('后台构建需要 Node >= 22.22')
for (const args of [['install', '--frozen-lockfile'], ['build']]) {
  const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    cwd: src, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, V2B_EMBED: '1' },
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
for (const file of ['assets/admin.js', 'assets/admin.css', 'favicon.png']) {
  if (!fs.existsSync(path.join(src, 'dist', file))) throw new Error(`构建产物缺少 ${file}`)
}
// Hash paths and bytes, including new source files; exclude ignored local config and dependencies.
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'frontend/admin'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter((file) => file && fs.existsSync(path.join(root, file))).sort()
const hash = crypto.createHash('sha256')
for (const file of files) {
  const bytes = fs.readFileSync(path.join(root, file))
  // Git may check out text as CRLF on Windows; keep the fingerprint portable.
  hash.update(file).update('\0').update(bytes.includes(0) ? bytes : bytes.toString('utf8').replace(/\r\n/g, '\n')).update('\0')
}
fs.mkdirSync(dest, { recursive: true })
for (const file of fs.readdirSync(dest)) {
  if (file !== 'custom.css') fs.rmSync(path.join(dest, file), { recursive: true, force: true })
}
fs.cpSync(path.join(src, 'dist/assets'), path.join(dest, 'assets'), { recursive: true })
fs.copyFileSync(path.join(src, 'dist/favicon.png'), path.join(dest, 'favicon.png'))
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(dest, 'LICENSE'))
fs.writeFileSync(path.join(dest, 'SOURCE'), `source: frontend/admin (in this repository)\nupstream: https://github.com/codeman857/v2board-admin.git\nupstream-commit: 10d112f4f9ee624c1db00e8453c7c5140ca797ed\nsource-sha256: ${hash.digest('hex')}\nbuilt: ${new Date().toISOString()}\n`)
console.log('后台构建完成，源码与产物请一起提交。服务器更新不需要 Node。')
