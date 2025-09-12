import { DaySchedule, ScheduleTemplate } from '@/lib/types';

export type SaveSchedulePayload = {
  date: string; // YYYY-MM-DD
  name: string;
  wakeStart: string;
  totalHours: number;
  templateId?: string;
  slots: Array<{
    index: number;
    title: string;
    desiredMin: number;
    rigid?: boolean;
    fixedStart?: string;
    optLen: number;
    optStart: number;
    actLen: number;
    start: number;
  }>;
};

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function saveScheduleFromDaySchedule(tpl: ScheduleTemplate, ds: DaySchedule) {
  const payload: SaveSchedulePayload = {
    date: todayStr(),
    name: tpl.name,
    wakeStart: ds.wakeStart,
    totalHours: ds.totalHours,
    templateId: tpl.id,
    slots: ds.slots.map((s, i) => ({
      index: i,
      title: s.title,
      desiredMin: s.desiredMin,
      rigid: !!s.rigid,
      fixedStart: s.fixedStart,
      optLen: Math.round(s.optLen),
      optStart: Math.round(s.optStart),
      actLen: Math.round(s.actLen),
      start: Math.round(s.start),
    })),
  };
  const res = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save schedule');
  return res.json();
}

export async function listSchedules() {
  const res = await fetch('/api/schedules', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to list schedules');
  return res.json() as Promise<Array<{ id: string; date: string; name: string; wakeStart: string; totalHours: number }>>;
}

export async function getScheduleByDate(date: string) {
  const res = await fetch(`/api/schedules?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to get schedule');
  return res.json();
}

