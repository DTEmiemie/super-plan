import { z } from 'zod';

function isHmValid(hhmm: string): boolean {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h >= 0 && h < 24 && mm >= 0 && mm < 60;
}

export const Hm = z
  .string()
  .refine((v) => isHmValid(v), { message: 'HH:mm 格式不合法' });

export const TemplateSlotInput = z.object({
  index: z.number().int().min(0).optional(),
  title: z.string().trim().default('未命名'),
  desiredMin: z.number().int().min(0).default(0),
  rigid: z.boolean().optional().default(false),
  fixedStart: Hm.optional(),
  tags: z.array(z.string()).optional(),
});

export const TemplateInput = z.object({
  name: z.string().trim().min(1),
  wakeStart: Hm,
  totalHours: z.number().min(0).max(24),
  slots: z.array(TemplateSlotInput).optional().default([]),
});

export type TemplateInputType = z.infer<typeof TemplateInput>;
export type TemplateSlotInputType = z.infer<typeof TemplateSlotInput>;

export function encodeTags(tags?: string[] | null): string | null {
  if (!tags || tags.length === 0) return null;
  try {
    return JSON.stringify(tags);
  } catch {
    return null;
  }
}

export function decodeTags(raw?: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? (arr as string[]) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export const ScheduleSlotInput = z.object({
  index: z.number().int().min(0).optional(),
  title: z.string().trim().min(1),
  desiredMin: z.number().int().min(0),
  rigid: z.boolean().optional(),
  fixedStart: Hm.optional(),
  optLen: z.number().int().min(0),
  optStart: z.number().int().min(0),
  actLen: z.number().int().min(0),
  start: z.number().int().min(0),
});

export const ScheduleInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1),
  wakeStart: Hm,
  totalHours: z.number().min(0).max(24),
  templateId: z.string().optional(),
  slots: z.array(ScheduleSlotInput).min(0),
});

export type ScheduleInputType = z.infer<typeof ScheduleInput>;
export type ScheduleSlotInputType = z.infer<typeof ScheduleSlotInput>;

