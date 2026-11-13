<img src="public/favicon.png" alt="logo" width="130" height="130" align="right"/>

[![](https://img.shields.io/badge/TgChat-@Sinab__Chat-blue.svg)](https://t.me/Sinab_Chat)

# V2Board Admin

An open-source V2Board admin frontend based on [wyx2685/v2board](https://github.com/wyx2685/v2board) (master, adapted to `99f8526e` of 2026-09-03).

[简体中文](README.zh-CN.md) · English

[![License: MIT + Commons Clause](https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-3DA639.svg?style=flat-square)](LICENSE)
[![Deploy: Cloudflare Workers](https://img.shields.io/badge/deploy-Cloudflare%20Workers-F38020.svg?style=flat-square&logo=cloudflare&logoColor=white)](#one-click-deploy)
[![Backend: wyx2685/v2board](https://img.shields.io/badge/backend-wyx2685%2Fv2board-000000.svg?style=flat-square&logo=github&logoColor=white)](https://github.com/wyx2685/v2board)
[![pnpm](https://img.shields.io/badge/toolchain-pnpm-F69220.svg?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Vite](https://img.shields.io/badge/build-Vite-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![Ant Design 6](https://img.shields.io/badge/Ant%20Design-6-1677FF.svg?style=flat-square&logo=antdesign&logoColor=white)](https://ant.design/)
[![ECharts](https://img.shields.io/badge/charts-ECharts-AA344D.svg?style=flat-square&logo=apacheecharts&logoColor=white)](https://echarts.apache.org/)
[![State: Zustand + TanStack Query](https://img.shields.io/badge/state-Zustand%20%2B%20TanStack%20Query-FF4154.svg?style=flat-square&logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18.svg?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![oxlint](https://img.shields.io/badge/lint-oxlint-00A3E0.svg?style=flat-square&logo=oxc&logoColor=white)](https://oxc.rs/)
![UI styles: 3](https://img.shields.io/badge/UI%20styles-3-7C3AED.svg?style=flat-square)

- Rewrites the original admin panel: pages, interactions and API requests match the original (including its Simplified Chinese UI), and the backend needs no changes
- Decoupled from the backend: a static site that connects to it through `config.js`
- Besides the Classic style, which matches the original, two more UI styles (Illustration and Geek) can be switched from the top bar after signing in

## One-click deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sinalphabeta/v2board-admin)

Deploys to Cloudflare Workers. Fill in two values on the deploy page:

- `V2B_API_HOST`: the V2Board backend URL, without `/api/v1`, e.g. `https://api.example.com`
- `V2B_SECURE_PATH`: the admin path, the same as (System Config → Security → Admin Path) on the backend

You can change them later under the Worker's Settings → Variables and Secrets; changes take effect immediately.

## Development

Requires Node ≥ 22.22, pnpm 11 and a V2board backend.

```bash
pnpm install
cp public/config.example.js config.local.js   # set the backend URL and admin path
pnpm dev                                      # http://localhost:5173
pnpm build                                    # output goes to dist/
V2B_EMBED=1 pnpm build                        # embedded build for v3board: fixed entry assets/admin.js and admin.css, used by v3board/build-admin.sh; do not name a lazy page index.tsx
```

## Sponsors

| Sponsor | Description |
| :---: | --- |
| <a href="https://t.me/awssb"><img src=".github/sponsors/awssb.png" alt="AWSSB" width="120"></a> | Dedicated AWS instances for rent, long-term rather than throwaway: high-spec c6in machines with automatic replacement and IP rotation. Contact [@awssb](https://t.me/awssb) on Telegram. |

## Star History

<a href="https://www.star-history.com/?repos=sinalphabeta%2Fv2board-admin&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=sinalphabeta/v2board-admin&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=sinalphabeta/v2board-admin&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=sinalphabeta/v2board-admin&type=date&legend=top-left" />
 </picture>
</a>
