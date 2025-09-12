import { ScheduleTemplate } from '@/lib/types';

const KEY = 'super-plan.template.v1';

export function loadTemplate(): ScheduleTemplate | null {
  // 兼容旧逻辑：如果本地有，就返回；优先 API 在页面中使用
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScheduleTemplate;
  } catch {
    return null;
  }
}

export function saveTemplate(t: ScheduleTemplate) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(t));
}

// Draft utils
function setJson(key: string, value: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}
function getJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
function del(key: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

export const draftKeys = {
  template: (id: string) => `draft.template.${id}`,
  schedule: (date: string) => `draft.schedule.${date}`,
};

export function saveTemplateDraft(id: string, tpl: ScheduleTemplate) {
  setJson(draftKeys.template(id), { updatedAt: Date.now(), data: tpl });
}
export function loadTemplateDraft(id: string): { updatedAt: number; data: ScheduleTemplate } | null {
  return getJson(draftKeys.template(id));
}
export function clearTemplateDraft(id: string) {
  del(draftKeys.template(id));
}

export function saveScheduleDraft(date: string, payload: any) {
  setJson(draftKeys.schedule(date), { updatedAt: Date.now(), data: payload });
}
export function loadScheduleDraft(date: string): { updatedAt: number; data: any } | null {
  return getJson(draftKeys.schedule(date));
}
export function clearScheduleDraft(date: string) {
  del(draftKeys.schedule(date));
}

// Snippet library (片段库)
const SNIPPET_KEY = 'super-plan.snippets.v1';
export type SnippetItem = { title: string; desiredMin: number; rigid?: boolean };

export function loadSnippetLibrary(): SnippetItem[] {
  const fromLs = getJson<SnippetItem[]>(SNIPPET_KEY);
  if (fromLs && Array.isArray(fromLs)) return fromLs;
  const defaults: SnippetItem[] = [
    { title: '阅读', desiredMin: 30 },
    { title: '运动', desiredMin: 45 },
    { title: '增量阅读', desiredMin: 100 },
    { title: '工作：专注', desiredMin: 240 },
    { title: '家庭/陪伴', desiredMin: 120 },
  ];
  setJson(SNIPPET_KEY, defaults);
  return defaults;
}

export function saveSnippetLibrary(list: SnippetItem[]) {
  setJson(SNIPPET_KEY, list);
}

export function sampleTemplate(): ScheduleTemplate {
  return {
    id: 'tpl-sample',
    name: '默认模板',
    wakeStart: '07:00',
    totalHours: 17,
    slots: [
      { id: crypto.randomUUID(), title: '早餐与新闻', desiredMin: 20, rigid: false },
      { id: crypto.randomUUID(), title: '增量阅读', desiredMin: 100, rigid: false },
      { id: crypto.randomUUID(), title: '工作：专注编程', desiredMin: 240, rigid: false },
      { id: crypto.randomUUID(), title: '运动：慢跑', desiredMin: 60, rigid: false },
      { id: crypto.randomUUID(), title: '家庭/陪伴', desiredMin: 240, rigid: false },
      { id: crypto.randomUUID(), title: '晚间阅读', desiredMin: 45, rigid: false }
    ],
  };
}
