# 变更记录（本次重点）

日期：2025-09-12

本次迭代的主要交付与注意事项如下。

## 前端与交互
- F/R 单列：未勾选=F（开始时间自动顺延，允许手动修改以固定该行），勾选=R（固定时长，严格不压缩）。
- 开始时间：默认由上一行“实际结束”自动顺延；手动填写即为固定开始（F）。
- 比例规则：
  - 充裕时：R 保持原时长，段内浮动按期望分钟权重等比扩展以填满段。
  - 不足时：先压缩浮动；仍不足时，R 仍不压缩，并产生“不可满足”的冲突提示。
- 今日执行页（/today）：
  - 顶部“进行中”状态条（活动名/剩余/结束于）（可在设置中开关）。
  - 表格当前行高亮；新增“开始”列可编辑（固定该行）。
- 底部吸附汇总条：计划结束、总实际、剩余分钟；可选显示总期望、压缩比、进度（设置中开关）。
- 新增“结束（HH:mm）”输入与回填：
  - 在模板与今日页支持按“结束时间”直接回填总时长（跨日自动处理）。
  - “按内容回填”将按当前实际总分钟回填总时长。
  - 设置新增“锁定结束时间”：开启后调整起点将保持结束不变（自动重算总时长）。
  - 新增 +15/−15 分钟微调按钮，便于快速校准；结束输入旁提示“跨日”。
  - “以当前时间开始”改为纯中文，点击立即以当前时间作为日起点重算。
  - 期望分钟支持清空（空视为 0），便于输入。
- 设置页（/settings）：
  - 新增显式“保存/撤销/恢复默认”；
  - 设置持久化至 DB，同时写入 localStorage 并通过 BroadcastChannel 实时广播到 /today；
  - 可配置：顶部状态条、底部汇总条、进度、冲突计数、总期望、压缩比。

## 追加（2025-09-15）
- 行内拖拽排序与快捷键（模板页、今日页）
  - 引入 dnd-kit，实现表格行拖拽排序；支持键盘排序与可访问性提升。
  - 快捷键（焦点在本行任意单元格即可）：
    - 移动行：Alt+↑ / Alt+↓
    - 复制本行：Alt+Shift+C
    - 插入下方：Alt+Shift+N
    - 插入上方：Alt+Shift+P
    - 拆分本行：Alt+Shift+S
  - 连续移动时保持焦点：每次移动后自动将焦点恢复到该行标题输入框，支持连续操作。
- 设置新增：showHotkeyHint（显示快捷键提示条）
  - 设置页加入开关；提示条可点击“不再提示”，同时更新 DB 与本地存储。

## 追加（2025-09-20）
- CI 与工程
  - 新增最小 CI（GitHub Actions）：push/PR 自动执行 `npm ci → tsc → vitest(--run) → next build`。
  - 在 `tests/` 增加 `smoke.test.ts`，避免“无测试时 CI 失败”，为后续用例提供模板。
  - 新增 `.gitattributes`：统一换行（LF）并标记常见二进制为 `binary`。
  - 仓库级 Git 优化：`fetch.prune=true`、`push.autoSetupRemote=true`。
- 文档
  - `CONTRIBUTING.md` 增补 Deploy Key/SSH 别名示例与团队约定。
  - README 增加 CI 徽章与“测试与 CI”说明。

## 数据与后端（本地开发用 SQLite）
- 接入 Prisma + SQLite，新增最小 API：
  - 模型：Template、TemplateSlot、Setting；新增 Schedule、ScheduleSlot、RunEvent（RunEvent 先建表，后续接入事件持久化）。
  - 模板 API：
    - GET/POST `/api/templates`
    - GET/PUT/DELETE `/api/templates/[id]`
  - 设置 API：
    - GET/PUT `/api/settings`
  - 当日计划 API：
    - GET `/api/schedules`（列表，或 `?date=YYYY-MM-DD` 获取当天）
    - POST `/api/schedules`（按日期 upsert 当日计划）
- 页面变更：
  - 模板页（/templates）首屏优先从 DB 拉取，无数据则自动创建默认模板；保存写 DB（失败兜底 localStorage）。
  - 今日执行页（/today）增加“保存当日计划”按钮，将当前 DaySchedule 持久化为当日记录。
  - 数据管理（/data）：列表与详情页（/data/[date]）用于查看历史当日计划。

## 开发体验与启动脚手架
- 新增启动前检查脚本 `scripts/preflight.mjs`：
  - 检查 .env 与 DATABASE_URL、Prisma Client 是否生成/过期、SQLite 文件存在与否；
  - 必要时自动执行 `npx prisma generate` 并给出下一步提示（如 `npm run db:setup`）。
- NPM 脚本：
  - `npm run db:setup`（相当于 `prisma generate && prisma migrate dev`）；
  - `postinstall` 自动 `prisma generate`；
  - `dev/build/start` 会自动执行 preflight 检查。
- 文档：README 已补充本地开发步骤、注意事项；`.env.example` 位于仓库根目录。

## 部署建议（摘要）
- 本地/单实例（可 Docker）：SQLite + Prisma，保存在持久卷；启用 WAL、定期备份。
- Serverless（如 Vercel）生产：不要用 SQLite，改用托管 Postgres（Vercel Postgres/Neon/Supabase），或前端 IndexedDB 本地存储方案。
- 前端纯托管 + 本地存储方案：可采用 IndexedDB + 导入/导出 + 归档（后续可选）。

## 后续计划
- 持久化 RunEvent（Begin/调整），当日自动保存与归档、导出/导入、历史回看与清理。
- 延迟分析与统计导出页面；更完善的冲突提示与修复建议。
