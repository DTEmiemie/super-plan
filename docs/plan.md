# super-plan 规划与设计（v0）

本文档汇总 SuperMemo「Plan」功能的关键理念，并给出 super-plan 的 MVP 范围、数据模型、核心算法、UI/交互、测试与路线图。全部内容以中文撰写，便于团队协作。

参考与术语映射：
- SuperMemo Plan（模板/执行/延迟/统计/提醒/拆分合并/刚性/固定时刻/随机与按周分配）
- 本项目术语：模板 Template、当日计划 Schedule、时段 Slot、浮动/固定/刚性、最优 opt、实际 act、延迟 delay、比例 percent

## 一、功能目标（MVP）
- 模板-执行分离：以模板生成当日计划，执行不反写模板，修改模板需显式确认。
- 浮动/固定/刚性时段：
  - 浮动：由系统优化顺序与时长；
  - 固定开始（F）：指定绝对起点（如 07:00）；
  - 固定时长（锁）：尽量保持设定的分钟数不被压缩（可与固定开始组合）。
- 按比例压缩：在可用时间不足时，对段内浮动时段按期望时长权重统一缩放，保持相对权重。
- 计算列：`optLen/optStart/optShift/actLen/start/delay/percent`。
- 执行流与提醒：`Begin`、`Begin and Shift`、提醒时间计算、终止/归档。
- 延迟分析：识别“超时/不足”活动，给出模板调整建议（将 `optLen` 写回 `desiredMin` 的建议稿）。
- 基础统计：按标签（活动名前缀或 `tags`）聚合的当日统计与 CSV/JSON 导出。

非 MVP（后续迭代）：
- 候选活动池（随机/按周）、月/年统计与批量归档、“++内嵌统计”语法、高级提醒、多设备同步、日历集成。

## 二、核心概念与字段
- Slot 字段（模板/当日通用）
  - `title`：活动名（可作为聚合前缀）
  - `desiredMin`：期望分钟数
  - `fixedStart?`：固定开始（可空；如 `07:00`）
  - `rigid`：刚性（bool）
  - 计算列（当日）：`optLen/optStart/actLen/start/optShift/delay/percent`
- 关键定义
  - `optLen = desiredMin`（不考虑固定/刚性）
  - `optStart[n] = optStart[n-1] + optLen[n-1]`（模板顺序）
  - `delay = start - optStart`（分钟）
  - `percent = actLen / optLen`

## 三、调度算法（纯函数）
调度核心保持纯函数：不进行 I/O、不得调用 `Date.now()`；通过上下文参数注入“现在”和时区。输出为不可变对象，便于测试复现。

1) 计算最优（opt）
- 输入：模板 slots（顺序）、`wakeStart`（当天起点分钟，或 0）、`totalHours`
- 规则：忽略所有固定/刚性，仅以 `desiredMin` 累加，得到 `optStart/optLen`。

2) 分段优化得到实际（act）
- 将一天按“固定开始”边界切分为若干段；每段处理：
  - 放入固定/刚性时段：
    - 固定开始：起点固定；
    - 然后安排刚性：时长固定；若兼有固定开始则起点+时长都固定；
  - 计算段长度与“固定/刚性总时长”，得到段内可用时间 `usable`；
  - 对段内“浮动非刚性”时段按权重缩放：
    - `scale = usable / sum(desiredMin_float)`（若分母为 0，则 `scale = 0`）
    - `actLen_i = desiredMin_i * scale`
- 段内按顺序赋 `start`，段间衔接从上一段末尾继续。
- 冲突与不可满足：若固定块重叠或段可用时间不足，标记冲突，给出修复建议（挪动或调整“固定时长/固定开始”）。

3) Begin / Begin and Shift
- `begin(slotId, now)`：将该 slot 的 `start = now`，并以 `now + actLen` 作为滚动起点重算后续；
- `beginAndShift(slotId, now)`：在 begin 的基础上，对“今日剩余的浮动时段”按比例压缩，使得计划在“日终（`wakeStart + totalHours`）”前尽量完成（保持固定开始/固定时长约束）。

4) Split / Merge
- `split(slotId, atMin)`：按相对分钟拆分为两段，分别继承属性并重算；
- `merge(a,b)`：合并相邻两段（同一段落内优先），重算。

5) Delays 分析
- 输入：当日 slots（含 `start/actLen`）与 `optStart/optLen`；
- 输出：
  - 每项 `delay/percent`；
  - Top 超时/不足活动；
  - 模板建议（例如对某活动 `desiredMin' = rollingAvg(optLen)` 或“写回 `optLen`”的提案）。

6) 时间与精度
- 统一“整分钟”运算与显示；
- 时区与 DST：采用 `date-fns-tz`，以“本地日界线”定义当天；
- 纯函数通过参数注入 `now` 与 `tz`，以便测试。

## 四、数据模型（Prisma/TS 抽象）
（后续以 Prisma/SQLite 落库；以下为字段规划）

- `Template`：`id` `name` `wakeStart` `totalHours` `createdAt` `updatedAt`
- `TemplateSlot`：`id` `templateId` `index` `title` `desiredMin` `fixedStart?` `rigid` `tags: string[]`
- `Schedule`：`id` `templateId` `date` `status(draft|running|done)` `startedAt?` `endedAt?`
- `ScheduleSlot`：`id` `scheduleId` `templateSlotId?` `index` `title` `desiredMin` `fixedStart?` `rigid` 计算缓存：`optLen` `optStart` `actLen` `start` `percent` `delay`
- `RunEvent`：`id` `scheduleSlotId` `action(begin|end|adjust)` `at`
- `StatDaily`：`id` `date` `tag` `totalMinutes`

TS 类型（位于 `src/lib/scheduler`）：
- `ScheduleTemplate`, `TemplateSlot`, `DaySchedule`, `DaySlot`, `RunEvent`, `ComputeResult`

## 五、UI/交互（Next.js + Tailwind）
- 模板编辑（`/templates/[id]`）
  - 列表编辑：标题、期望分钟、固定开始、刚性开关、拖拽排序；
  - 预估计算列（opt/act 对比）与冲突提示；
  - 操作：拆分、合并、复制为新模板、保存。
- 当日执行（`/today`）
  - 顶部：当前时间、下一提醒；
  - 表格：`start/actLen/percent/delay` 实时刷新；当前项高亮；
  - 操作：Begin、Begin and Shift、提醒+N 分钟、完成/终止。
- 延迟面板
  - 今日延迟热图、Top 超时/不足项；一键生成“写回模板”建议稿（需确认后应用）。
- 统计面板
  - 按 `tags` 或标题前缀聚合；导出 CSV/JSON。

## 六、测试计划（Vitest）
- `compute.test.ts`：
  - 无固定/有固定/多段/刚性；Begin/Begin and Shift；拆分/合并；
  - `delay/percent/optShift` 公式正确；
  - 注入 `now/tz` 的可复现性。
- `delays.test.ts`：延迟聚合、建议生成与边界用例。
- `stats.test.ts`：标签聚合与导出格式。
- 组件交互（RTL）：Begin、Split、Fix 开关的关键行为。

## 七、路线图
- Phase 1（MVP）
  - 核心纯函数（opt/act/分段缩放/Begin/Shift）与单测；
  - 模板编辑、当日执行、延迟基础视图；CSV 导出。
- Phase 2
  - 候选活动（随机/按周）；
  - 月/年统计与批量归档；
  - 冲突修复建议与刚性/固定优先级设置。
- Phase 3
  - “++内嵌统计”语法；
  - 多设备提醒、时间轴可视化、外部日历集成。

## 八、风险与约束
- 时区/DST：务必以 `date-fns(-tz)` 处理本地日界线与夏令时；
- 刚性/固定冲突：提供检测与建议修复（移动/缩放/优先级）；
- 精度与舍入：统一整分策略；
- 纯函数边界：核心禁止 I/O 与 `Date.now()`；上下文注入。

## 十、持久化与部署注意（实践指引）
- 本地开发：SQLite（Prisma）。首次运行：复制 `.env.example` 至 `.env` 并执行 `npm run db:setup`。
- 生产与 Vercel：不要使用 SQLite（Serverless 无持久 FS）。建议切换到托管 Postgres（Vercel Postgres/Neon/Supabase）。
- Docker 单实例：可用 SQLite，启用 WAL 与定期备份；保持单副本写入。
- 当前持久化范围：
  - Template/TemplateSlot、Setting 已落库；Setting 同步写入 localStorage 以便前端跨路由即时生效。
  - Schedule/ScheduleSlot/RunEvent 将在下一迭代持久化（支持当日自动保存、归档、导入/导出与历史回看）。
- 前端输入习惯：
  - 期望分钟可清空（空=0）；开始时间默认自动顺延，手动填写即固定为 F；R 严格不压缩。

## 九、验收标准（MVP）
- 能创建模板并生成当日计划；
- 在存在固定时段时，段内浮动时段可按比例缩放，计算列正确；
- Begin/Begin and Shift 生效并能重算后续；
- 延迟面板能列出 Top 超时/不足活动并导出统计；
- 单测覆盖核心算法的主要路径与边界。

---
如需更细的算法伪代码与类型签名，将在实现阶段同步补充到 `src/lib/scheduler/*.ts` 的 JSDoc 与相邻文档中。
