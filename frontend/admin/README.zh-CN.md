<img src="public/favicon.png" alt="logo" width="130" height="130" align="right"/>

[![](https://img.shields.io/badge/TgChat-@Sinab__Chat-blue.svg)](https://t.me/Sinab_Chat)

# V2Board Admin

基于 [wyx2685/v2board](https://github.com/wyx2685/v2board)（master，已适配到 2026-09-03 的 `99f8526e`）的开源 V2Board 管理端前端。

简体中文 · [English](README.md)

[![许可证：MIT + Commons Clause](https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-3DA639.svg?style=flat-square)](LICENSE)
[![部署：Cloudflare Workers](https://img.shields.io/badge/deploy-Cloudflare%20Workers-F38020.svg?style=flat-square&logo=cloudflare&logoColor=white)](#一键部署)
[![后端：wyx2685/v2board](https://img.shields.io/badge/backend-wyx2685%2Fv2board-000000.svg?style=flat-square&logo=github&logoColor=white)](https://github.com/wyx2685/v2board)
[![工具链：pnpm](https://img.shields.io/badge/toolchain-pnpm-F69220.svg?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![构建：Vite](https://img.shields.io/badge/build-Vite-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![语言：TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![Ant Design 6](https://img.shields.io/badge/Ant%20Design-6-1677FF.svg?style=flat-square&logo=antdesign&logoColor=white)](https://ant.design/)
[![图表：ECharts](https://img.shields.io/badge/charts-ECharts-AA344D.svg?style=flat-square&logo=apacheecharts&logoColor=white)](https://echarts.apache.org/)
[![状态管理：Zustand + TanStack Query](https://img.shields.io/badge/state-Zustand%20%2B%20TanStack%20Query-FF4154.svg?style=flat-square&logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![测试：Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18.svg?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![代码检查：oxlint](https://img.shields.io/badge/lint-oxlint-00A3E0.svg?style=flat-square&logo=oxc&logoColor=white)](https://oxc.rs/)
![界面风格：3 种](https://img.shields.io/badge/UI%20styles-3-7C3AED.svg?style=flat-square)

- 重写原版管理端，页面、操作、接口请求都与原版一致，后端不需要任何改动
- 前后端分离：一个纯静态站点，通过 `config.js` 连接后端
- 除了与原版一致的经典风格，另有插画、极客两种界面风格，登录后在顶栏切换

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sinalphabeta/v2board-admin)

部署到 Cloudflare Workers，部署页面上填写两项：

- `V2B_API_HOST`：V2Board 后端地址，不带 `/api/v1`，例如 `https://api.example.com`
- `V2B_SECURE_PATH`：后台路径，与后端「系统配置 → 安全 → 后台路径」一致

之后在 Worker 的「设置 → 变量和机密」里修改，立即生效。

## 本地开发

需要 Node ≥ 22.22、pnpm 11，以及一个 V2board 后端。

```bash
pnpm install
cp public/config.example.js config.local.js   # 填写后端地址和后台路径
pnpm dev                                      # http://localhost:5173
pnpm build                                    # 构建内容在 dist/
V2B_EMBED=1 pnpm build                        # 内嵌到 v3board 时用：入口固定为 assets/admin.js、admin.css，由 v3board/build-admin.sh 调用；懒加载页面不要取名 index.tsx
```

## 赞助商

| 赞助商 | 介绍 |
| :---: | --- |
| <a href="https://t.me/awssb"><img src=".github/sponsors/awssb.png" alt="AWSSB" width="120"></a> | AWS 独享机租用，非日抛：c6in 高配机型，支持自动补机、自动换 IP。Telegram 联系 [@awssb](https://t.me/awssb) |

## Star History

<a href="https://www.star-history.com/?repos=sinalphabeta%2Fv2board-admin&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=sinalphabeta/v2board-admin&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=sinalphabeta/v2board-admin&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=sinalphabeta/v2board-admin&type=date&legend=top-left" />
 </picture>
</a>
