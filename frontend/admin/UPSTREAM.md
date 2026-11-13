# 后台源码维护

本目录引入自 https://github.com/codeman857/v2board-admin.git
基线提交：10d112f4f9ee624c1db00e8453c7c5140ca797ed。
保留原 LICENSE（MIT + Commons Clause）与原文档。此后本仓库在此目录维护完整后台整合。

在仓库根目录运行 `node scripts/build-admin.mjs`（Node >=22.22，pnpm 11），或 `bash build-admin.sh`。
源码、pnpm-lock.yaml 和 public/assets/admin 构建产物一起提交；服务器执行 update.sh 即可，不需要安装前端工具。
SOURCE 记录整个源码目录的 SHA-256，便于确认产物来源。

合并后端上游时保留本目录和自定义接口。合并后台上游时，以以上提交作三方合并基线，重点复核 src/app/router.tsx、src/layouts/menu.ts、src/pages/plan/PlanDrawer.tsx、src/api/services/plan.ts；第三方模块为独立文件。合并后重新构建与回归，不能直接覆盖编译产物。
