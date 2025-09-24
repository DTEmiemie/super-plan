import { ScheduleTemplate, UiSettings } from '@/lib/types';
import { hmToMin, minToHm } from '@/lib/utils/time';

export async function fetchTemplates(): Promise<ScheduleTemplate[]> {
  const res = await fetch('/api/templates', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

function normalizeHm(hm?: string): string | undefined {
  const v = hm || '';
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return v;
  const asMin = hmToMin(v || '');
  return minToHm(asMin);
}

function buildTemplatePayload(tpl: Partial<ScheduleTemplate>) {
  const name = (tpl.name || '').trim() || '模板';
  const wakeStart = normalizeHm(tpl.wakeStart || '00:00')!;
  const totalHours = Math.max(0, Math.min(24, Number(tpl.totalHours || 0)));
  const slots = (tpl.slots || []).map((s, i) => {
    const title = (s.title || '').trim() || '未命名';
    const desiredMin = Math.max(0, Math.round(Number(s.desiredMin || 0)));
    const rigid = !!s.rigid;
    const fixedStart = s.fixedStart && /^(\d{1,2}):(\d{2})$/.test(s.fixedStart) ? s.fixedStart : undefined;
    const tags = Array.isArray(s.tags) ? s.tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()) : undefined;
    return { index: i, title, desiredMin, rigid, fixedStart, tags };
  });
  return { name, wakeStart, totalHours, slots };
}

async function throwWithDetailsIfNotOk(res: Response, fallback: string) {
  if (res.ok) return;
  try {
    const data = await res.json();
    const detail = data?.error ? `${data.error}${data?.details ? `: ${JSON.stringify(data.details)}` : ''}` : JSON.stringify(data);
    throw new Error(`${fallback}（${res.status}）：${detail}`);
  } catch {
    throw new Error(`${fallback}（${res.status}）`);
  }
}

export async function createTemplate(tpl: Partial<ScheduleTemplate>): Promise<ScheduleTemplate> {
  const payload = buildTemplatePayload(tpl);
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await throwWithDetailsIfNotOk(res, '创建模板失败');
  return res.json();
}

export async function updateTemplate(id: string, tpl: ScheduleTemplate): Promise<ScheduleTemplate> {
  const payload = buildTemplatePayload(tpl);
  const res = await fetch(`/api/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await throwWithDetailsIfNotOk(res, '更新模板失败');
  return res.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete template');
}

// Settings API
export type UiSettingsDto = Partial<UiSettings>;

export async function fetchUiSettings(): Promise<UiSettingsDto> {
  const res = await fetch('/api/settings', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function saveUiSettings(s: UiSettingsDto): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
  if (!res.ok) throw new Error('Failed to save settings');
}

// Snippets API
export type SnippetDto = { id: string; title: string; desiredMin: number; rigid?: boolean };

export async function fetchSnippets(): Promise<SnippetDto[]> {
  const res = await fetch('/api/snippets', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch snippets');
  return res.json();
}

export async function createSnippet(payload: { title: string; desiredMin: number; rigid?: boolean }): Promise<SnippetDto> {
  const res = await fetch('/api/snippets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create snippet');
  return res.json();
}

export async function deleteSnippet(id: string): Promise<void> {
  const res = await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete snippet');
}
