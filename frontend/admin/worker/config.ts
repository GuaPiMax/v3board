// 运行时配置 config.js（window.settings）的内容，打包（vite.config.ts）与 Cloudflare Worker（worker/index.ts）共用。
// 变量都可以不设置，没有设置的用下面的默认值（与 public/config.example.js 相同）。

/** 变量的来源：打包时是 process.env，Worker 里是 Worker 的变量和机密 */
export type SettingsEnv = Record<string, string | undefined>

/** 按 V2B_* 变量生成 window.settings */
export function settingsFromEnv(env: SettingsEnv) {
  return {
    title: env.V2B_TITLE ?? 'V2Board',
    host: env.V2B_API_HOST ?? '',
    secure_path: env.V2B_SECURE_PATH ?? 'admin',
    theme: {
      sidebar: env.V2B_THEME_SIDEBAR ?? 'light',
      header: env.V2B_THEME_HEADER ?? 'dark',
      color: env.V2B_THEME_COLOR ?? 'default',
    },
    background_url: env.V2B_BACKGROUND_URL ?? '',
    logo: env.V2B_LOGO ?? '',
    // 公开演示站：登录页显示并预填演示账号，顶栏标题旁显示提示（见 src/app/settings.ts 的 DemoSettings）
    ...(env.V2B_DEMO_EMAIL
      ? {
          demo: {
            email: env.V2B_DEMO_EMAIL,
            password: env.V2B_DEMO_PASSWORD ?? '',
            ...(env.V2B_DEMO_NOTICE !== undefined && { notice: env.V2B_DEMO_NOTICE }),
          },
        }
      : {}),
  }
}

/** config.js 的完整内容，第一行注释说明这份配置在哪里修改 */
export function renderConfigJs(env: SettingsEnv, comment: string): string {
  return `// ${comment}
window.settings = ${JSON.stringify(settingsFromEnv(env), null, 2)}
`
}
