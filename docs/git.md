# Git 使用规范（super-plan）

## 分支
- `main`：稳定分支，始终可构建
- 功能分支：`feat/<scope>-<short-desc>`（例：`feat/today-insert-rows`）
- 修复分支：`fix/<scope>-<short-desc>`
- 文档分支：`docs/<short-desc>`

## 提交（Conventional Commits）
- 类型：`feat|fix|docs|refactor|test|chore|build|ci`
- 范围 scope：目录或模块（例：`today`、`api`、`scheduler`）
- 示例：
  - `feat(today): 行内插入/复制/批量粘贴/片段库`
  - `feat(api): snippets CRUD + Prisma 模型`
  - `docs: 更新 CHANGELOG 与 README`

## 迁移与数据库
- 修改 `prisma/schema.prisma` 后：
  - 本地创建/应用迁移：`npm run prisma:migrate -- --name <name>`
  - 确认 `.env` 指向 `file:./prisma/dev.db`
  - 不要提交 `prisma/*.db*` 文件（已在 `.gitignore`）

## 提交流程建议
1. 开分支（feature/fix/docs）
2. 实现代码 + 同步更新文档（README / docs/plan.md / docs/CHANGELOG.md）
3. 本地验证：`npm run build`、若改 schema 则 `npm run prisma:migrate`
4. 提交：小步提交，信息清晰
5. PR 内容：动机、变更点、影响面、迁移说明、截图/录屏（如 UI）

## 强制不提交内容
- `node_modules/`、`.next/`、`prisma/*.db*`、`.env`（仅 `.env.example`）

## 其它建议
- 纯函数约束的算法模块（scheduler）需保持可测试与可复现；避免直接读时间与 I/O
- 对用户影响大的交互，优先提供设置开关（如“自动保存到数据库”）
- 重要变更请记录到 `docs/CHANGELOG.md`
