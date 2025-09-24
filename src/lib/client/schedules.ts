import { DaySchedule, ScheduleTemplate } from '@/lib/types';
import { hmToMin, minToHm } from '@/lib/utils/time';

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
  // 规范化与兜底，避免后端 400（zod 校验）
  const normName = (tpl.name || '').trim() || '今日计划';
  const normWake = (() => {
    const m = ds.wakeStart?.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return ds.wakeStart;
    // 尝试用解析后的分钟数回填为 HH:mm；非法则退回 00:00
    return minToHm(hmToMin(ds.wakeStart || '00:00'));
  })();

  const payload: SaveSchedulePayload = {
    date: todayStr(),
    name: normName,
    wakeStart: normWake,
    totalHours: ds.totalHours,
    templateId: tpl.id,
    slots: ds.slots.map((s, i) => {
      const title = (s.title || '').trim() || '未命名';
      const fixedStart = (() => {
        if (!s.fixedStart) return undefined;
        return /^(\d{1,2}):(\d{2})$/.test(s.fixedStart) ? s.fixedStart : undefined;
        })();
      return {
        index: i,
        title,
        desiredMin: Math.max(0, Math.round(s.desiredMin || 0)),
        rigid: !!s.rigid,
        fixedStart,
        optLen: Math.round(s.optLen),
        optStart: Math.round(s.optStart),
        actLen: Math.round(s.actLen),
        start: Math.round(s.start),
      };
    }),
  };
  const res = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    try {
      const data = await res.json();
      const detail = data?.error ? `${data.error}${data?.details ? `: ${JSON.stringify(data.details)}` : ''}` : JSON.stringify(data);
      throw new Error(`保存失败（${res.status}）：${detail}`);
    } catch {
      throw new Error(`保存失败（${res.status}）`);
    }
  }
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
