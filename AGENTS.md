# Repository Guidelines

## 项目结构与模块组织
- `src/app` — Next.js 路由（App Router）与页面。
- `src/components` — 可复用 UI 组件（Tailwind）。
- `src/lib` — 领域模型、调度器核心（纯 TypeScript）、工具与日期函数。
- `prisma/schema.prisma` — 数据库模型（Prisma；开发期使用 SQLite）。
- `tests` — 单元/集成测试（Vitest）。
- `public` — 静态资源。
- `scripts` — 维护与一次性脚本。

## 构建、测试与开发命令
- `npm run dev` — 启动本地开发服务器。
- `npm run build` — 生成生产构建。
- `npm run start` — 运行生产构建。
- `npm run lint` — ESLint + TypeScript 校验。
- `npm run test` — 运行测试（Vitest）。
- `npx prisma migrate dev` — 创建/应用数据库迁移。
- `npx prisma studio` — 打开 Prisma Studio 检视本地数据库。

## 代码风格与命名约定
- 使用 TypeScript；2 空格缩进；开启分号；单引号。
- 文件：`kebab-case`；组件/类型：`PascalCase`；函数/变量：`camelCase`。
- 样式优先使用 Tailwind 工具类，避免内联样式；优先组件组合而非自定义 CSS。
- 调度器核心保持纯函数（不进行 I/O 或 `Date.now()`）；通过参数注入时间与上下文。
- 时间计算首选 `date-fns`；输入校验使用 `zod`。

## 测试规范
- 框架：Vitest（组件配合 React Testing Library）。
- 命名：与源码路径镜像，使用 `*.test.ts(x)`（例：`src/lib/scheduler/scheduler.test.ts`）。
- 重点：调度器核心单测与基础 API 测试；关键路径优先、务实覆盖率。
- 运行：`npm run test`，或按路径过滤：`npm run test -- src/lib/scheduler`。

## 提交与 Pull Request 规范
- 提交遵循 Conventional Commits：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`build`、`ci`。
- 提交小而聚焦；非显而易见的变更在正文说明动机与影响。
- PR 必含：变更说明、关联 issues、UI 截图（如有）、数据库迁移备注与测试证据。

## 安全与配置提示
- 切勿提交密钥；使用 `.env.local`（已被忽略），示例放 `.env.example`。
- 开发库：`prisma/dev.db`（SQLite）；生产建议使用 Postgres。
- 修改 schema 后执行 `npx prisma generate` 更新客户端。

## Agent 使用说明
- 修改遵循本文件；采用最小、外科手术式补丁，避免大范围重构。
- 代码变更需同步更新文档与测试；保持公共 API 类型稳定。

### Git/Commit 约定（给 Agent）
- 提交风格：Conventional Commits（feat/fix/docs/refactor/test/chore/build/ci）。
- 提交粒度：小而原子；一次提交只做一件事。涉及 schema 变更时与迁移文件同一提交。
- 何时提交：
  - 完成一个“可独立验证”的小功能/修复/文档更新后立刻提交。
  - 若任务包含多个小步骤，使用 plan 标记每步完成后提交一次。
- 提交信息建议格式：
  - `feat(<scope>): <简短描述>`（scope 如 today/templates/api/scheduler）
  - 正文描述动机、影响面与验证方式（必要时）。
- 不要提交：`node_modules`、`.next`、`prisma/*.db*`、`.env`（仅 `.env.example`）。
- 分支：按 `feat/<scope>-<desc>` 或 `fix/<scope>-<desc>` 创建并在其上提交（如用户未指定分支，默认在当前分支提交）。
