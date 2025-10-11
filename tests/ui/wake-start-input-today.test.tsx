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

vi.mock('@/lib/client/schedules', async () => ({
  saveScheduleFromDaySchedule: async () => ({}),
}));

vi.mock('next/link', () => ({
  default: (props: any) => React.createElement('a', { ...props, href: props.href }, props.children),
}));

import TodayPage from '../../src/app/today/page';

describe('TodayPage 起点输入', () => {
  it('输入 930 时不丢焦，允许持续编辑', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(React.createElement(TodayPage));

    await new Promise((r) => setTimeout(r, 0));

    const input = div.querySelector('input[data-testid="tdy-wake-start"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    if (!input) return;

    input.focus();
    input.value = '930';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('930');
  });
});
