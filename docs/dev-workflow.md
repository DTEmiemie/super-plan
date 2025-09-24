# 开发工作流建议（Trunk 与特性分支）

面向人类协作者的务实指引：在保持速度的同时，维持较好的可回退、可审计与稳定性。

## 目标与适用
- 目标：更快交付、更少回归、更容易回滚/审阅。
- 适用：本仓库（Next.js + TypeScript + Prisma），单人或小团队协作。

## 总结（两句话）
- 默认直接推 `main`（Trunk-based）即可；本仓库已提供本地自检与 CI 兜底。
- 当变更“高风险/跨层/需评审/需一键回滚”时，使用短生命周期的特性分支 + PR。

---

## 何时直接推 main（Trunk-based）
- 小改动：文档、样式、文案、低风险 UI/逻辑微调。
- 原子提交能自证正确：本地通过 `lint/test/build`（见“自检”）。
- 原型/演示阶段，以速度为先。

推荐命令：
```bash
# 自检（等同 pre-push）
npm run lint && npm run test -- --run && npm run build
# 推送
git push origin main
```

## 何时使用特性分支 + PR
- 修改数据库 Schema、公共 API、核心算法（scheduler）。
- 大范围重构或跨多模块的行为变更。
- 需要评审、截图/说明、迁移备注，或希望“一键回滚整包改动”。

分支命名：
- `feat/<scope>-<desc>`、`fix/<scope>-<desc>`（示例：`feat/scheduler-actions`、`fix/api-validate`）。

合并策略（PR 页面）
- Rebase and merge（推荐）
  - 优点：保留原子提交、线性历史、无 merge commit（便于 `git bisect`）。
  - 代价：提交 SHA 会变化（rebase）。
- Squash and merge
  - 优点：压缩为单提交，历史整洁，便于“一键回滚 PR”。
  - 代价：丢失中间提交颗粒度。
- 建议：
  - 提交序列已规整（Conventional Commits）→ 选 Rebase。
  - 提交噪音多/只需最终语义 → 选 Squash。

PR 清单（Checklist）
- [ ] 标题遵循 Conventional Commits（`feat|fix|docs|refactor|test|chore|build|ci`）。
- [ ] 描述动机/影响面/是否有迁移/回滚策略。
- [ ] 截图或接口示例（如涉及 UI/API）。
- [ ] 本地通过 `lint/test/build`；CI 绿灯。

---

## 提交与信息规范
- 原子提交、小步快跑；一次提交只做一件事。
- 示例：
  - `feat(scheduler): 新增 begin/split 纯函数与单测`
  - `fix(api): 修复模板 tags 的 JSON 编解码`
  - `docs(readme): 增补本地开发步骤`

## 自检与 CI
- 本地自检：
  - `npm run lint`（TypeScript 类型检查）
  - `npm run test -- --run`（Vitest）
  - `npm run build`（Next.js 生产构建）
- 可选：启用 pre-push 钩子（自动自检）
```bash
cp scripts/git-hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
# 如需跳过：git push --no-verify
```
- CI：GitHub Actions 在 PR / push 时自动跑 `npm ci → tsc → vitest --run → next build`。

## 回滚策略
- 主推 main：直接 `git revert <sha>` 回滚单个提交。
- 特性分支 + PR：使用“Squash and merge”后，回滚更容易（只需 revert 那个 squash commit）。
- 数据库迁移：若涉及 Prisma schema，建议“变更与迁移文件同一提交”，回滚时一起 revert。

## 常见问答（FAQ）
- Q：为什么不强制所有改动都走分支 + PR？
  - A：本仓库强调速度与务实，小型/低风险改动用 Trunk 更快；高风险再引入分支流程。
- Q：什么时候需要截图或演示？
  - A：涉及 UI 变化、交互流程变更、或接口契约变化时，在 PR 附上截图/示例能显著加速评审。
- Q：如何“一键回滚”某次发布？
  - A：若该次发布合并方式为 Squash，则直接 revert 那个 squash commit 即可。

## 快速步骤模板
- Trunk（默认）
```bash
git checkout main
# 改动…
npm run lint && npm run test -- --run && npm run build
git commit -m "feat(scope): ..."
git push origin main
```
- 特性分支（高风险）
```bash
git checkout -b feat/<scope>-<desc>
# 改动…
npm run lint && npm run test -- --run && npm run build
git push -u origin HEAD
gh pr create --base main --title "feat(scope): ..." --body "..."
# 评审通过后在网页选择 Rebase 或 Squash 并合并，删除分支
```

---
如无特殊说明，本文档约定适用于本仓库所有目录与模块；与 `AGENTS.md` 一致，以“最小、外科手术式补丁”为基本策略。
