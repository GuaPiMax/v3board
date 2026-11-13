// Cloudflare Workers 部署（README 的「Deploy to Cloudflare」按钮，配置在 wrangler.jsonc）：
// 打包产物 dist/ 由 Workers 静态资源直接返回，只有 /config.js 经过这里，按 Worker 的变量和机密（V2B_*）生成，
// 在 Cloudflare 后台修改后立即生效，不用重新打包。静态资源里没有的其他路径也会进到这里，返回 404。
import { renderConfigJs, type SettingsEnv } from './config'

const CONFIG_COMMENT = '由 Cloudflare Worker 的变量生成（V2B_*），在 Worker 的「设置 → 变量和机密」里修改'

export default {
  fetch(request: Request, env: SettingsEnv): Response {
    if (new URL(request.url).pathname !== '/config.js') return new Response('Not Found', { status: 404 })
    // Worker 生成的响应不套用 _headers 的规则，这里写上与 _headers 里 /config.js 相同的响应头
    return new Response(renderConfigJs(env, CONFIG_COMMENT), {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  },
}
