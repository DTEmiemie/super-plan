# super-plan

[![CI](https://github.com/DTEmiemie/super-plan/actions/workflows/ci.yml/badge.svg)](https://github.com/DTEmiemie/super-plan/actions/workflows/ci.yml)

面向 SuperMemo「Plan」功能的现代化实现与演进规划。以 Next.js（App Router）+ TypeScript 为前端基础，调度器核心保持纯函数（不做 I/O 与 `Date.now()`），时间计算优先 `date-fns`，数据层建议 Prisma（开发期 SQLite）。

- 功能与算法设计文档：见 `docs/plan.md`
- 开发与代码规范：见 `AGENTS.md`
 - 本次变更摘要：见 `docs/CHANGELOG.md`

## 当前状态
- 已完成：前端原型（模板编辑/今日执行/设置）、文档 `docs/plan.md`、最小 API（Prisma + SQLite，本地开发）。
- 新增：模板页与今日页支持行内拖拽排序（dnd-kit）与键盘快捷键（见下文）。
- 待执行：完善延迟分析、统计导出、IndexedDB/服务端持久化切换策略等。

## 目录约定（规划）
- `src/app` — Next.js 路由与页面
- `src/components` — 复用 UI 组件（Tailwind）
- `src/lib` — 领域模型与调度器核心（纯 TS）
- `prisma/schema.prisma` — 数据库模型（Prisma；开发期 SQLite）
- `tests` — 单元/集成测试（Vitest）
- `public` — 静态资源
- `scripts` — 维护与一次性脚本

更多规范与命令参见 `AGENTS.md`。

## 测试与 CI
- 本地测试：`npm run test -- --run`（Vitest；测试文件放在 `tests/**/*.test.ts(x)`）。
- 已启用最小 CI（GitHub Actions）：对 push/PR 自动执行 `npm ci → tsc（lint）→ vitest（--run）→ next build`。
- CI 环境变量：`DATABASE_URL=file:./prisma/dev.db`（仅用于生成 Prisma Client 与通过预检，不做迁移）。
- 首个 smoke 测试见 `tests/smoke.test.ts`，可据此逐步补充真实用例。

## 主分支保护（建议开启）
- 打开 GitHub 仓库页面 → `Settings` → `Branches`。
- 在 `Branch protection rules` 中点击 `Add rule`。
- `Branch name pattern` 填写：`main`。
- 勾选 `Require status checks to pass before merging`，并在列表中勾选 `CI` 工作流。
- 可选：勾选 `Require pull request reviews before merging`（要求至少 1 次代码评审）。
- 可选：勾选 `Require linear history`、`Dismiss stale pull request approvals` 以提升流程稳健性。
- 保存规则后，未通过 CI 的 PR 将无法合并到 `main`，也禁止直接向 `main` 强推（如启用相关选项）。

## 个人开发推荐流（单分支直推）
- 适用：单人项目、你本地会先跑通再推代码。
- 建议配置（已为本仓库启用）：
  - 线性历史：开启（便于回滚与定位问题）。
  - 禁止强推/删除：开启（避免误操作改写历史）。
  - 必需 PR / 必需状态检查：关闭（直推 `main` 不被拦，CI 作为事后复验）。
- 日常步骤：
  - 本地自检：`npm run lint && npm run test -- --run && npm run build`
  - 推送：`git push origin main`
  - CI 会在远端自动跑一遍；如有红灯，修完再推一次即可。
- 可选增强：
  - 本地 pre-push 钩子（自动自检）：
    - 安装：`cp scripts/git-hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push`
    - 跳过：`git push --no-verify`（跳过所有本地钩子）
    - 说明：Git 钩子不随仓库传播（只作用于当前克隆）；如换机器，请按上面命令安装一次。
  - 上线（手动 git pull）：服务器执行 `git pull --ff-only && npm ci && npx prisma migrate deploy && npm run build`，用 PM2/systemd 重启。

## 快捷键与拖拽排序（新）
- 拖拽排序：表格首列“↕”手柄可拖拽上下重排。
- 键盘快捷键（焦点在该行任意单元格即可）：
  - 移动行：`Alt + ↑ / Alt + ↓`
  - 复制本行：`Alt + Shift + C`
  - 插入下方：`Alt + Shift + N`
  - 插入上方：`Alt + Shift + P`
  - 拆分本行：`Alt + Shift + S`
- 连续移动：每次移动后会自动把焦点恢复到该行标题输入框，支持连续按键移动。
- 提示开关：设置页新增“显示快捷键提示条”，也可在提示条上点击“不再提示”。

## 本地开发（含数据库）
1) 准备环境
- Node 18+
- 安装依赖：`npm install`（postinstall 会自动执行 `prisma generate`）

2) 初始化数据库（SQLite）
- 复制环境变量：`cp .env.example .env`（文件位于仓库根目录）
- 一键初始化：`npm run db:setup`（等价于 `prisma generate && prisma migrate dev`）

3) 启动开发服务器（含预检）
- `npm run dev`（自动执行 `scripts/preflight.mjs` 检查 .env/Prisma Client/SQLite 文件，必要时自动 generate 并给出提醒）
- 打开 `http://localhost:3000`

4) 常用命令
- 生成客户端：`npm run prisma:generate`
- 本地迁移：`npm run prisma:migrate`
- 数据库可视化：`npm run prisma:studio`

5) 何时需要重新 generate/migrate？
- 当 `prisma/schema.prisma` 修改后：运行 `npm run prisma:migrate`（或 `npm run db:setup`）
- 切分支/拉代码导致 schema 变化：运行 `npm run db:setup`
- 若忘了，启动命令会通过 `preflight` 提醒，并自动尝试 `prisma generate`

6) 常见问题排查
- 报错 “未找到 ./prisma/dev.db” 或路径异常：
  - 请确认 `.env` 中 `DATABASE_URL` 为 `file:./prisma/dev.db`，且命令在项目根目录执行。
  - 若曾在 `prisma/` 子目录内手动运行 `prisma migrate dev`，可能生成了 `prisma/prisma/dev.db`。请将其移动到 `prisma/dev.db`，或删除后在项目根目录运行 `npm run db:setup`。
  - 启动时的 `preflight` 会打印解析后的绝对路径并给出移动提示。

## 注意事项（重要）
- 运行时环境
  - 本地使用 SQLite（`DATABASE_URL=file:./prisma/dev.db`）；Vercel/Serverless 生产环境请改用托管 Postgres。
  - Docker 单实例可以安全使用 SQLite（建议 WAL、单副本写入、定期备份卷）。
  - 本项目在服务端启动时会自动尝试设置 SQLite PRAGMA：`journal_mode=WAL` 与 `synchronous=NORMAL`（失败会忽略），提升写入可靠性与性能。
- 数据持久化策略（当前进度）
  - 模板 Template/TemplateSlot：持久化到 DB；同时写入 localStorage 作为兜底缓存。
  - 设置 Settings：持久化到 DB；同时写入 localStorage 并通过 BroadcastChannel 实时广播，今日页面立刻生效。
  - 当日计划（Schedule/RunEvent）：将于后续迭代持久化（今日先内存计算，提供“保存当日计划”入口）。
- 交互语义
  - F/R 单列：未勾选=F（开始时间自动顺延，可手动改以固定）；勾选=R（固定时长，严格不压缩）。
  - 期望分钟输入可清空（空视为 0），便于编辑。
  - “以当前时间开始”改为纯中文，并立即重算；当前进行中高亮与顶部状态条可在“设置”开启/关闭。
