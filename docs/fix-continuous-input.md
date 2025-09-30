# 修复"开始"列无法连续输入问题

## 问题描述

**现象**：在今日执行 (`/today`) 和模板编辑 (`/templates`) 页面中，"开始"列的输入框无法连续输入和连续删除字符，每输入一个字符后输入框就失去响应。

**影响范围**：
- `src/app/today/page.tsx` - 今日执行页面的"开始"列输入框
- `src/app/templates/page.tsx` - 模板编辑页面的"开始（预估）"列输入框

## 根本原因分析

### 1. 受控组件的异步问题

**原始实现**（错误）：
```tsx
const [fixedDraft, setFixedDraft] = useState<Record<string, string>>({});

<input
  value={fixedDraft[s.id] !== undefined ? fixedDraft[s.id] : (s.fixedStart ?? '')}
  onChange={(e) => {
    const v = e.target.value;
    setFixedDraft(prev => ({ ...prev, [s.id]: v }));
  }}
/>
```

**问题点**：
1. **受控组件**：`value` 属性由 React state 控制
2. **异步更新**：`setState` 是异步的，状态更新存在延迟
3. **渲染干扰**：每次输入触发 `onChange` → `setState` → 组件重新渲染
4. **值回退**：重新渲染时，`value` 可能还是旧值，导致输入被"吃掉"
5. **焦点丢失**：频繁的重新渲染可能导致 DOM 节点重新创建，输入框失去焦点

### 2. 级联渲染问题

```tsx
function updateSlot(id: string, patch: Partial<TemplateSlot>) {
  setWorking((w) => ({
    ...w,
    slots: w.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }));
}
```

每次 `updateSlot` 触发：
- `working` 状态更新
- 整个页面组件重新渲染
- `schedule = computeSchedule({ template: working })` 重新计算
- 所有 `Row` 组件重新渲染
- 输入框 DOM 可能被重新创建

## 解决方案

### 核心思路：改用非受控组件

**新实现**（正确）：
```tsx
<input
  type="text"
  key={`${s.id}-${s.fixedStart ?? ''}`}  // ✓ 确保值变化时重新挂载
  defaultValue={s.fixedStart ?? ''}       // ✓ 非受控：浏览器原生管理输入
  onFocus={() => {
    setEditing(true);  // 只设置编辑状态标志
  }}
  onBlur={(e) => {
    const raw = (e.target as HTMLInputElement).value;  // ✓ 直接从 DOM 读取
    setEditing(false);

    // 失焦时一次性提交
    if (raw == null || raw === '') {
      updateSlot(s.id, { fixedStart: undefined });
    } else {
      const norm = parseHmLoose(raw);
      if (norm) {
        updateSlot(s.id, { fixedStart: norm });
      }
    }
  }}
/>
```

### 关键改进点

#### 1. 非受控组件 (`defaultValue`)
- **浏览器原生管理**：输入值由浏览器 DOM 直接管理，不依赖 React state
- **零延迟**：输入过程中没有任何 React 状态更新，完全流畅
- **无渲染干扰**：输入过程中不触发组件重新渲染

#### 2. `key` 属性强制重新挂载
```tsx
key={`${s.id}-${s.fixedStart ?? ''}`}
```
- 当 `fixedStart` 值变化时，`key` 变化
- React 会销毁旧输入框，创建新输入框
- 新输入框的 `defaultValue` 会显示更新后的值
- 保证数据和视图的同步

#### 3. 失焦时提交
- **输入过程**：完全不调用 `updateSlot`，不触发渲染
- **失焦时刻**：从 `e.target.value` 直接读取 DOM 值，准确无误
- **一次性提交**：只在失焦时更新一次 `working` 状态

#### 4. 移除草稿状态管理
- **之前**：需要 `fixedDraft` 状态来临时存储输入值
- **现在**：完全不需要，浏览器自己管理
- **更简洁**：符合 KISS 原则（Keep It Simple, Stupid）

## 代码变更对比

### today/page.tsx

**移除的代码**：
```tsx
// ❌ 不再需要草稿状态
const [fixedDraft, setFixedDraft] = useState<Record<string, string>>({});

// ❌ 不再需要 onChange 更新草稿
onChange={(e) => {
  const v = e.target.value;
  setFixedDraft(prev => ({ ...prev, [s.id]: v }));
}}

// ❌ 不再需要 onInput
onInput={(e) => {
  const v = (e.target as HTMLInputElement).value;
  setFixedDraft(prev => ({ ...prev, [s.id]: v }));
}}
```

**新增的代码**：
```tsx
// ✓ 使用 defaultValue + key
<input
  key={`${s.id}-${s.fixedStart ?? ''}`}
  defaultValue={s.fixedStart ?? ''}
  onBlur={(e) => {
    const raw = (e.target as HTMLInputElement).value;
    // ... 提交逻辑
  }}
/>
```

### templates/page.tsx

应用相同的修复逻辑，保持两个页面行为一致。

## 技术原理

### 受控组件 vs 非受控组件

| 特性 | 受控组件 | 非受控组件 |
|------|----------|------------|
| 值管理 | React state (`value`) | 浏览器 DOM (`defaultValue`) |
| 更新方式 | `onChange` + `setState` | 浏览器原生输入 |
| 渲染频率 | 每次输入触发渲染 | 输入过程零渲染 |
| 性能 | 较差（频繁渲染） | 优秀（零渲染） |
| 读取方式 | 从 state 读取 | 从 DOM 读取 |
| 适用场景 | 需要实时验证/格式化 | 简单输入，失焦时提交 |

### React 的 key 属性

```tsx
key={`${s.id}-${s.fixedStart ?? ''}`}
```

**作用**：
1. React 通过 `key` 识别组件身份
2. `key` 变化 → React 认为是不同组件
3. 销毁旧组件，创建新组件
4. 新组件的 `defaultValue` 会反映新值

**为什么需要**：
- 非受控组件的 `defaultValue` 只在**首次挂载时**生效
- 后续更新 `defaultValue` 不会改变输入框显示值
- 通过改变 `key` 强制重新挂载，实现值更新

## 验证方法

### 手动测试
1. 打开今日执行页面 (`/today`)
2. 点击任意一行的"开始"列输入框
3. 尝试连续输入：`0830` → 应该能流畅输入所有字符
4. 尝试连续删除：按 Backspace 删除所有字符 → 应该能流畅删除
5. 失焦后检查：值应该被规范化为 `08:30`
6. 点击下一行的"开始"列，重复测试

### 自动化测试
```tsx
// 示例测试用例
test('开始列输入框支持连续输入', async () => {
  const input = screen.getByTestId('tdy-start-slot-1');

  await userEvent.click(input);
  await userEvent.type(input, '0830');

  expect(input).toHaveValue('0830');

  await userEvent.tab(); // 失焦

  expect(input).toHaveValue('08:30'); // 规范化后的值
});
```

## 性能优化效果

### 之前（受控组件）
- 输入 "0830" 需要 4 次渲染
- 每次渲染都重新计算 `schedule`
- 可能导致输入卡顿、丢字

### 现在（非受控组件）
- 输入 "0830" 零渲染
- 失焦时才触发 1 次渲染
- 输入体验丝般顺滑

## 遵循的设计原则

1. **KISS (Keep It Simple, Stupid)**
   - 移除了复杂的 `fixedDraft` 状态管理
   - 直接使用浏览器原生能力

2. **YAGNI (You Aren't Gonna Need It)**
   - 移除了不必要的 `onChange`、`onInput` 处理
   - 只保留必需的 `onFocus` 和 `onBlur`

3. **DRY (Don't Repeat Yourself)**
   - 同时修复了 Today 和 Templates 页面
   - 统一使用相同的非受控组件模式

4. **性能优先**
   - 输入过程零渲染，极致性能
   - 用户体验显著提升

## 相关文件

- `src/app/today/page.tsx` - 今日执行页面（主要修改：第189-242行）
- `src/app/templates/page.tsx` - 模板编辑页面（主要修改：第154-192行）
- `docs/today-editing.md` - 原有输入行为文档（需要更新）

## 后续改进建议

1. **更新现有文档**：修改 `docs/today-editing.md`，说明已改用非受控组件
2. **统一其他输入框**：考虑将"期望（min）"列也改为非受控组件，保持一致性
3. **添加单元测试**：为连续输入场景添加自动化测试
4. **性能监控**：验证渲染次数是否真的减少了

## 总结

通过将"开始"列输入框从**受控组件改为非受控组件**，彻底解决了无法连续输入的问题。核心思路是：
1. 使用 `defaultValue` 让浏览器管理输入值
2. 使用 `key` 确保值变化时重新挂载
3. 失焦时从 DOM 直接读取并提交

这个修复不仅解决了问题，还显著提升了性能和代码简洁性，完美体现了 React 受控 vs 非受控组件的权衡取舍。

---

## CI 测试环境修复

### 问题描述

在修复输入框问题并推送后，CI 持续失败，报错：

```
TypeError: Cannot read properties of undefined (reading 'get')
❯ Object.<anonymous> node_modules/webidl-conversions/lib/index.js:325:94
❯ Object.<anonymous> node_modules/whatwg-url/lib/URL.js:3:21

Vitest caught 5 unhandled errors during the test run.
```

### 根本原因分析

1. **jsdom 的 polyfill 依赖**
   - jsdom 在 Node.js 环境中需要手动 polyfills（TextEncoder、TextDecoder、crypto 等 Web APIs）
   - 这些 API 在浏览器中原生支持，但在 Node.js 中不存在

2. **Polyfill 时序问题**
   - 创建了 `vitest.setup.ts` 尝试注入 polyfills
   - 但 setup 文件运行时，`whatwg-url`、`webidl-conversions` 等依赖模块**已经开始加载**
   - 这些模块在初始化时就访问了 `TextEncoder` 等全局对象
   - 导致即使后续注入 polyfill 也无法生效

3. **多次尝试失败**
   - 尝试 1：条件判断 + 赋值 → 时序太晚，无效
   - 尝试 2：`Object.assign` 强制覆盖 → 依然时序问题，无效
   - 根本原因：手动 polyfill 方案无法解决模块加载顺序问题

### 最终解决方案：使用 happy-dom

**为什么选择 happy-dom：**
- ✅ 对 Node.js 环境兼容性更好，**无需任何 polyfills**
- ✅ 更轻量、更快（启动速度更快）
- ✅ 更稳定（无 jsdom 的复杂依赖链）
- ✅ 符合 KISS 原则：配置更简洁

**变更文件：**

1. **`package.json`** - 添加依赖
   ```json
   {
     "devDependencies": {
       "happy-dom": "^19.0.2",
       ...
     }
   }
   ```

2. **`vitest.config.ts`** - 切换测试环境
   ```diff
   export default defineConfig({
     test: {
   -   environment: 'jsdom',
   -   setupFiles: ['./vitest.setup.ts'],
   +   environment: 'happy-dom',
       globals: true,
     },
     ...
   });
   ```

3. **`vitest.setup.ts`** - 不再需要（可删除或保留备用）

### 验证结果

**本地测试：**
```bash
npm run test -- --run

✓ tests/lib/scheduler/compute.test.ts  (4 tests) 6ms
✓ tests/ui/start-input-today.test.tsx  (1 test) 192ms
✓ tests/ui/pure-input-blur-commit-today.test.tsx  (2 tests) 373ms
✓ tests/ui/loose-time-templates.test.tsx  (1 test) 173ms
✓ tests/ui/start-input-templates.test.tsx  (1 test) 158ms
✓ tests/ui/wake-start-input-templates.test.tsx  (1 test) 163ms
✓ tests/ui/loose-time-today.test.tsx  (1 test) 158ms
✓ tests/smoke.test.ts  (1 test) 3ms
✓ tests/ui/wake-start-input-today.test.tsx  (1 test) 147ms

Test Files  9 passed (9)
     Tests  13 passed (13)
  Duration  4.23s
```

**CI 构建：**
```
✓ Type Check (tsc)
✓ Unit Tests (Vitest)
✓ Build (Next.js)

Status: completed success
Duration: 1m10s
```

### 技术对比：jsdom vs happy-dom

| 特性 | jsdom | happy-dom |
|------|-------|-----------|
| Node.js 兼容性 | 需要手动 polyfills | 原生兼容，无需 polyfills |
| 启动速度 | 较慢（复杂依赖链） | 快速（轻量实现） |
| 内存占用 | 较高 | 较低 |
| Web API 覆盖 | 全面（接近真实浏览器） | 足够测试使用 |
| 维护成本 | 高（需处理 polyfill） | 低（开箱即用） |
| 适用场景 | 需要完整浏览器环境模拟 | 单元/集成测试（推荐） |

### 遵循的设计原则

1. **KISS (Keep It Simple, Stupid)**
   - 从复杂的 polyfill 方案切换到开箱即用的 happy-dom
   - 移除了 `vitest.setup.ts` 的配置复杂度

2. **YAGNI (You Aren't Gonna Need It)**
   - 不需要完整的浏览器环境模拟（jsdom 提供的）
   - 只需要足够的 DOM API 来运行测试

3. **性能优先**
   - happy-dom 启动更快，测试执行更快
   - 减少 CI 运行时间

### 相关提交

- `80e38eb` - feat(today): 单元格点击即聚焦（输入框修复）
- `4a077ae` - fix(input/start): 允许编辑"开始"列（非受控组件）
- `[commit]` - fix(test): 添加 jsdom polyfills（失败尝试）
- `a375b03` - fix(test): 改进 jsdom polyfills 使用 Object.assign（依然失败）
- `a3c166a` - fix(test): 使用 happy-dom 替代 jsdom（最终成功）✅

### 后续建议

1. ✅ 已更新 `AGENTS.md` 测试规范章节，说明使用 happy-dom
2. ✅ CI 配置无需修改（`.github/workflows/ci.yml`）
3. 🔄 可考虑删除 `vitest.setup.ts`（已不再使用）
4. 📚 团队成员应了解：本项目测试环境使用 happy-dom，而非 jsdom
