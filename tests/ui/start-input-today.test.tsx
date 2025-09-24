import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

// Mock API used by TodayPage
vi.mock('@/lib/client/api', async () => {
  return {
    fetchTemplates: async () => [
      {
        id: 'tpl-1',
        name: '模板',
        wakeStart: '07:00',
        totalHours: 8,
        slots: [
          { id: 's-1', title: 'A', desiredMin: 60, rigid: false },
          { id: 's-2', title: 'B', desiredMin: 60, rigid: false },
        ],
      },
    ],
    createTemplate: async (t: any) => ({ id: 'tpl-x', name: t.name || '模板', wakeStart: t.wakeStart || '07:00', totalHours: t.totalHours || 8, slots: t.slots || [] }),
    updateTemplate: async (id: string, t: any) => ({ ...t, id }),
    saveUiSettings: async () => {},
  };
});

// Mock schedules API (not used directly here)
vi.mock('@/lib/client/schedules', async () => {
  return {
    saveScheduleFromDaySchedule: async () => ({}),
  };
});

// Silence next/link warnings in tests
vi.mock('next/link', () => ({
  default: (props: any) => React.createElement('a', { ...props, href: props.href }, props.children),
}));

// Import after mocks
import TodayPage from '@/app/today/page';

describe('TodayPage 开始列输入', () => {
  it('输入过程中不丢焦，完成 HH:mm 后生效', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(React.createElement(TodayPage));

    // 等待一次微任务，允许 useEffect 完成首轮渲染
    await new Promise((r) => setTimeout(r, 0));

    const input = div.querySelector('input[data-testid^="tdy-start-"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    if (!input) return;

    input.focus();
    expect(document.activeElement).toBe(input);

    // 逐步输入 2 -> 23 -> 23: -> 23:00
    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('2');
    expect(document.activeElement).toBe(input);

    input.value = '23';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('23');
    expect(document.activeElement).toBe(input);

    input.value = '23:';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('23:');
    expect(document.activeElement).toBe(input);

    input.value = '23:00';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('23:00');
    expect(document.activeElement).toBe(input);
  });
});
