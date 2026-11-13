// V2Board 管理端运行时配置（window.settings），改完刷新页面即可，不用重新打包：
//   - 本地开发：复制为项目根目录的 config.local.js 再修改；没有 config.local.js 时直接使用本文件
//   - 部署：修改打包产物里的 dist/config.js（打包时没设 V2B_* 环境变量，它就是本文件的副本）
//   - Cloudflare Workers 一键部署：修改 Worker 的变量（见 .dev.vars.example），本文件不生效
window.settings = {
  // 站点标题（留空时登录后使用后端「站点名称」）
  title: 'V2Board',
  // 后端地址，不带 /api/v1；留空表示与管理端同源（例：https://api.example.com）
  host: '',
  // 后台路径，需与 V2Board「系统配置 → 安全 → 后台路径」一致
  secure_path: 'admin',
  // 主题（登录后以后端「系统配置 → 个性化」为准）
  theme: {
    // 边栏风格：light / dark
    sidebar: 'light',
    // 顶部风格：light / dark
    header: 'dark',
    // 主题色：default / darkblue / black / green
    color: 'default',
  },
  // 登录页背景图 URL
  background_url: '',
  // LOGO URL（留空时登录后使用后端 LOGO）
  logo: '',
  // 公开演示站（可选）：配置后登录页预填并显示演示账号，顶栏标题旁显示 notice（留空则不显示）；正式部署不要配置
  // demo: { email: 'admin@example.com', password: 'admin123456', notice: '演示站 · 数据每小时整点复原' },
}
