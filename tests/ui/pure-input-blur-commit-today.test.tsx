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

import TodayPage from '../../src/app/today/page';

describe('TodayPage 纯输入模式提交', () => {
  it('开始：输入 930 → 失焦后显示 09:30', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(React.createElement(TodayPage));

    await new Promise((r) => setTimeout(r, 0));

    const start = div.querySelector('input[data-testid^="tdy-start-"]') as HTMLInputElement | null;
    expect(start).toBeTruthy();
    if (!start) return;

    start.focus();
    start.value = '930';
    start.dispatchEvent(new Event('input', { bubbles: true }));
    // 立即可见为非受控显示；blur 提交归一化
    start.blur();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const start2 = div.querySelector('input[data-testid^="tdy-start-"]') as HTMLInputElement | null;
    expect(start2).toBeTruthy();
    if (!start2) return;
    expect(start2.value).toBe('09:30');
  });

  it('期望：输入 45 → 失焦后写回 desiredMin', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(React.createElement(TodayPage));

    await new Promise((r) => setTimeout(r, 0));

    const min = div.querySelector('input[data-testid^="tdy-min-"]') as HTMLInputElement | null;
    expect(min).toBeTruthy();
    if (!min) return;

    min.focus();
    min.value = '45';
    min.dispatchEvent(new Event('input', { bubbles: true }));
    min.blur();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const min2 = div.querySelector('input[data-testid^="tdy-min-"]') as HTMLInputElement | null;
    expect(min2).toBeTruthy();
    if (!min2) return;
    expect(min2.value).toBe('45');
  });
});
