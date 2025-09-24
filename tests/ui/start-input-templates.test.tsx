import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

// Mock API used by TemplatesPage
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
    updateTemplate: async (id: string, t: any) => ({ ...t, id }),
    saveUiSettings: async () => {},
    createTemplate: async (t: any) => ({ id: 'tpl-x', name: t.name || '模板', wakeStart: t.wakeStart || '07:00', totalHours: t.totalHours || 8, slots: t.slots || [] }),
    deleteTemplate: async () => {},
    fetchSnippets: async () => [],
    createSnippet: async () => ({ id: 'snip-1', title: 'X', desiredMin: 15, rigid: false }),
    deleteSnippet: async () => {},
  };
});

vi.mock('next/link', () => ({
  default: (props: any) => React.createElement('a', { ...props, href: props.href }, props.children),
}));

import TemplatesPage from '../../src/app/templates/page';

describe('TemplatesPage 开始列输入', () => {
  it('输入过程中不丢焦，完成 HH:mm 后生效', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(React.createElement(TemplatesPage));

    await new Promise((r) => setTimeout(r, 0));

    const input = div.querySelector('input[data-testid^="tpl-start-"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    if (!input) return;
    input.focus();

    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('2');
    expect(document.activeElement).toBe(input);

    input.value = '23:00';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('23:00');
    expect(document.activeElement).toBe(input);
  });
});
