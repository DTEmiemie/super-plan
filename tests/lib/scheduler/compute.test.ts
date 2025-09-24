import { describe, it, expect } from 'vitest';
import { computeSchedule } from '../../../src/lib/scheduler/compute';
import type { ScheduleTemplate, TemplateSlot } from '../../../src/lib/types';

function tpl(wakeStart: string, totalHours: number, slots: Array<Partial<TemplateSlot> & { title: string; desiredMin: number }>): ScheduleTemplate {
  return {
    id: 't1',
    name: 'test',
    wakeStart,
    totalHours,
    slots: slots.map((s, i) => ({
      id: `s${i + 1}`,
      title: s.title,
      desiredMin: s.desiredMin,
      rigid: !!s.rigid,
      fixedStart: s.fixedStart,
      tags: s.tags as any,
    })),
  };
}

describe('computeSchedule', () => {
  it('no fixed, no rigid → sequential with equal lengths', () => {
    const template = tpl('07:00', 3, [
      { title: 'A', desiredMin: 60 },
      { title: 'B', desiredMin: 60 },
      { title: 'C', desiredMin: 60 },
    ]);
    const r = computeSchedule({ template });
    expect(r.warnings?.length || 0).toBe(0);
    expect(r.slots.map(s => [s.title, s.start, s.actLen])).toEqual([
      ['A', 7 * 60, 60],
      ['B', 8 * 60, 60],
      ['C', 9 * 60, 60],
    ]);
    // percent and delay
    r.slots.forEach((s) => {
      expect(Math.round(s.percent * 100)).toBe(100);
      expect(s.delay).toBe(0);
    });
  });

  it('fixed start anchors segment; non-rigid scale within segment', () => {
    // Day: 07:00 → 10:00; first slot fixed at 08:00, all non-rigid 60m each → available 120 for 3 items → 40 each
    const template = tpl('07:00', 3, [
      { title: 'A', desiredMin: 60, fixedStart: '08:00' },
      { title: 'B', desiredMin: 60 },
      { title: 'C', desiredMin: 60 },
    ]);
    const r = computeSchedule({ template });
    expect(r.warnings?.length || 0).toBe(0);
    expect(r.slots.map(s => [s.title, s.start, s.actLen])).toEqual([
      ['A', 8 * 60, 40],
      ['B', 8 * 60 + 40, 40],
      ['C', 9 * 60 + 20, 40],
    ]);
  });

  it('rigid preserved when segment tight; floats scale to fill', () => {
    // Segment 08:00-10:00 available 120; B rigid 60, others float 60 → floats get 30 each
    const template = tpl('08:00', 2, [
      { title: 'A', desiredMin: 60 },
      { title: 'B', desiredMin: 60, rigid: true },
      { title: 'C', desiredMin: 60 },
    ]);
    const r = computeSchedule({ template });
    expect(r.warnings?.length || 0).toBe(0);
    expect(r.slots.map(s => [s.title, s.actLen])).toEqual([
      ['A', 30],
      ['B', 60],
      ['C', 30],
    ]);
    // Starts chain within the segment
    expect(r.slots[0].start).toBe(8 * 60);
    expect(r.slots[1].start).toBe(8 * 60 + 30);
    expect(r.slots[2].start).toBe(8 * 60 + 90);
  });

  it('insufficient for rigid → warning, rigid kept', () => {
    const template = tpl('07:00', 1, [
      { title: 'R', desiredMin: 90, rigid: true },
    ]);
    const r = computeSchedule({ template });
    expect((r.warnings || []).length).toBeGreaterThan(0);
    expect(r.slots[0].actLen).toBe(90);
  });
});

