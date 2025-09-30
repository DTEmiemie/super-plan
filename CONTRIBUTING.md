# Contributing Guide

感谢参与 super-plan 开发！本项目采用 Next.js + TypeScript + Prisma（本地 SQLite），并遵循最小、外科手术式变更与文档/测试同步的基本原则。

## 开发环境
- Node 18+
- 安装依赖：`npm install`（postinstall 会自动 `prisma generate`）
- 初始化数据库（SQLite）：
  - `cp .env.example .env`
  - `npm run db:setup`（= `prisma generate && prisma migrate dev`）
- 启动：`npm run dev`（含预检脚本 `scripts/preflight.mjs`）
- 测试环境：Vitest + happy-dom（轻量 DOM 环境，无需 polyfills）

## Git 工作流
- 分支命名：
  - 功能：`feat/<scope>-<short-desc>`（例：`feat/today-insert-rows`）
  - 修复：`fix/<scope>-<short-desc>`
  - 文档：`docs/<short-desc>`
- 提交信息：使用 Conventional Commits
  - `feat`: 新功能（UI/算法/API）
  - `fix`: 修缺陷
  - `docs`: 文档或注释
  - `refactor`: 重构（无行为变化）
  - `test`: 测试或测试基建
  - `chore`: 工程脚手架/依赖/脚本
  - `build`/`ci`: 构建系统/CI
  - 示例：
    - `feat(today): 行内插入/复制/批量粘贴/片段库`
    - `feat(api): snippets CRUD + Prisma 模型`
    - `docs: 更新 CHANGELOG 与 README`
- 提交粒度：一次提交只做一件事；代码+文档+测试尽可能同步。
- PR 规范：
  - 描述：动机/变更点/影响面
  - 截图：UI 变更请附关键页面截图或说明
  - 迁移：如涉及 `prisma/schema.prisma`，请附迁移说明与本地验证步骤
  - 测试：说明验证方式；如增改测试请说明覆盖点

## Git/SSH 与 Deploy Key
- 本仓库通过仓库级 Deploy Key 访问，推荐使用自定义 SSH Host `github.com-repo` 绑定专用私钥，避免误用个人 Key。
- 远程地址示例：`git@github.com-repo:DTEmiemie/super-plan.git`
- 本机 `~/.ssh/config` 示例：
  
  ```
  Host github.com-repo
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_super_plan
    IdentitiesOnly yes
  ```

- 备选（保持标准 github.com 但仍使用该 Deploy Key）：在仓库内设置：
  - `git config --local core.sshCommand "ssh -i ~/.ssh/id_ed25519_super_plan -o IdentitiesOnly=yes"`

- 团队约定：请勿随意改动远程为 `github.com`，或切换为个人 SSH Key；如确需调整，请在 PR 说明动机与影响。

## 变更要求
- 调度核心保持纯函数：不得进行 I/O 或直接调用 `Date.now()`；通过参数注入上下文
- UI 改动遵循 Tailwind 规范；避免内联 style
- 文档：更新 `docs/CHANGELOG.md` 记录重要变化；必要时更新 `docs/plan.md` 与 README
- 不要提交：`node_modules`、`.next`、`prisma/*.db*`、`.env`（仅 `.env.example`）

## 常用命令
- 构建：`npm run build`
- 测试：`npm run test`（watch 模式）或 `npm run test -- --run`（单次运行）
- 预检：随 dev/build/start 自动执行，检查 `.env`、Prisma Client、SQLite 文件
- 迁移：
  - 创建并应用：`npm run prisma:migrate -- --name <name>`
  - 可视化：`npm run prisma:studio`

## 提交前检查（建议）
- `npm run build` 本地通过
- 若涉及 API：验证 200/4xx 行为与错误信息
- 若涉及 schema：确认迁移文件生成并应用成功；`.env.example` 是否需要更新

欢迎以小而清晰的 PR 推进功能迭代！
