import { ScheduleTemplate, UiSettings } from '@/lib/types';

export async function fetchTemplates(): Promise<ScheduleTemplate[]> {
  const res = await fetch('/api/templates', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

export async function createTemplate(tpl: Partial<ScheduleTemplate>): Promise<ScheduleTemplate> {
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tpl),
  });
  if (!res.ok) throw new Error('Failed to create template');
  return res.json();
}

export async function updateTemplate(id: string, tpl: ScheduleTemplate): Promise<ScheduleTemplate> {
  const res = await fetch(`/api/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tpl),
  });
  if (!res.ok) throw new Error('Failed to update template');
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
