import { DaySchedule, DaySlot, ScheduleTemplate } from '@/lib/types';
import { hmToMin } from '@/lib/utils/time';

type ComputeInput = {
  template: ScheduleTemplate;
};

// 简化版：
// - 忽略 fixedStart（后续迭代）
// - 刚性时段：若总时长不足，优先保留刚性；若刚性之和也超预算，按比例共同压缩（避免负值）
export function computeSchedule({ template }: ComputeInput): DaySchedule {
  const warnings: string[] = [];
  const dayStartAbs = hmToMin(template.wakeStart);
  const dayEndAbs = dayStartAbs + Math.max(0, Math.round(template.totalHours * 60));

  // 1) 计算最优（忽略固定/刚性）
  const optSlots: Pick<DaySlot, 'optStart' | 'optLen'>[] = [];
  {
    let cursor = dayStartAbs;
    for (const s of template.slots) {
      optSlots.push({ optStart: cursor, optLen: s.desiredMin });
      cursor += s.desiredMin;
    }
  }

  // 2) 基于固定开始（F）构建段
  type Segment = {
    startAbs: number;
    endAbs: number; // 开区间上界
    startIndex: number; // 包含
    endIndexExclusive: number; // 不含
  };

  const fixedMap = new Map<number, number>(); // index -> fixedStartAbs
  template.slots.forEach((s, idx) => {
    if (s.fixedStart) {
      const abs = hmToMin(s.fixedStart);
      fixedMap.set(idx, abs);
    }
  });

  const segments: Segment[] = [];
  let segStartAbs = dayStartAbs;
  let i = 0;
  while (i < template.slots.length) {
    if (fixedMap.has(i)) {
      const fixedAbs = fixedMap.get(i)!;
      if (fixedAbs < segStartAbs) {
        warnings.push(`固定开始时间早于段起点：第${i + 1}行 ${template.slots[i].title}`);
      }
      // 段A：segStartAbs 到 fixedAbs（不含固定槽）
      if (i > 0) {
        segments.push({ startAbs: segStartAbs, endAbs: Math.min(fixedAbs, dayEndAbs), startIndex: segments.length === 0 ? 0 : segments[segments.length - 1].endIndexExclusive, endIndexExclusive: i });
      } else {
        // i==0，前段为空
        segments.push({ startAbs: segStartAbs, endAbs: Math.min(fixedAbs, dayEndAbs), startIndex: 0, endIndexExclusive: 0 });
      }
      // 段B：从 fixedAbs 开始，包含固定槽，直到下一个固定或日终再处理
      segStartAbs = Math.min(fixedAbs, dayEndAbs);
      // 将起点更新，继续向后，下一次遇到固定或结束时再收束
      // 但需要保证固定槽在后段内，因此先推进 i 到下一个固定前收束时再统一 push
      // 我们采用另一种更清晰的分段构建：一次遍历生成边界索引与边界时间
      i++;
      // 为了简化，将“包含固定槽的段”在之后统一创建
      // 我们会在第二轮创建包含固定槽的段
    } else {
      i++;
    }
  }

  // 重新构建段：根据固定索引把列表切成 [beforeFirstFixed], [fixed..beforeNextFixed], ..., [lastFixed..end],
  const fixedIndices = Array.from(fixedMap.keys()).sort((a, b) => a - b);
  segments.length = 0;
  let startIdx = 0;
  let currentStartAbs = dayStartAbs;
  for (let fi = 0; fi < fixedIndices.length; fi++) {
    const idx = fixedIndices[fi];
    const fixedAbs = fixedMap.get(idx)!;
    // 前段：不含固定槽
    segments.push({ startAbs: currentStartAbs, endAbs: Math.min(fixedAbs, dayEndAbs), startIndex: startIdx, endIndexExclusive: idx });
    // 后段：含固定槽起头，结束于下一个固定或日终，由下一轮或最终封口
    const nextFixedAbs = fi + 1 < fixedIndices.length ? Math.min(fixedMap.get(fixedIndices[fi + 1])!, dayEndAbs) : dayEndAbs;
    const nextIdx = fi + 1 < fixedIndices.length ? fixedIndices[fi + 1] : template.slots.length;
    segments.push({ startAbs: Math.min(fixedAbs, dayEndAbs), endAbs: nextFixedAbs, startIndex: idx, endIndexExclusive: nextIdx });
    startIdx = nextIdx;
    currentStartAbs = nextFixedAbs;
  }
  if (fixedIndices.length === 0) {
    segments.push({ startAbs: dayStartAbs, endAbs: dayEndAbs, startIndex: 0, endIndexExclusive: template.slots.length });
  } else if (startIdx < template.slots.length) {
    // 尾段：无固定
    segments.push({ startAbs: currentStartAbs, endAbs: dayEndAbs, startIndex: startIdx, endIndexExclusive: template.slots.length });
  }

  const actStart: number[] = new Array(template.slots.length).fill(0);
  const actLen: number[] = new Array(template.slots.length).fill(0);

  // 段内调度：刚性优先保留；不足时标记冲突并压缩刚性（极端情况）
  for (const seg of segments) {
    const slots = template.slots.slice(seg.startIndex, seg.endIndexExclusive);
    if (slots.length === 0) continue;
    const available = Math.max(0, seg.endAbs - seg.startAbs);
    const sumRigid = slots.filter(s => s.rigid).reduce((a, s) => a + s.desiredMin, 0);
    const sumFloat = slots.filter(s => !s.rigid).reduce((a, s) => a + s.desiredMin, 0);

    let scaleRigid = 1;
    let scaleFloat = 1;
    if (available >= sumRigid + sumFloat) {
      // 充裕：刚性保持原时长，浮动等比扩展以填满段
      scaleRigid = 1;
      scaleFloat = sumFloat > 0 ? (available - sumRigid) / sumFloat : 0;
    } else if (available >= sumRigid) {
      scaleRigid = 1;
      scaleFloat = sumFloat > 0 ? (available - sumRigid) / sumFloat : 0;
    } else {
      // 严格模式：刚性不可压缩；浮动置 0；产生不可满足警告
      scaleRigid = 1;
      scaleFloat = 0;
      warnings.push(`固定时长（R）不可压缩且总长超出可用时间：第${seg.startIndex + 1}–${seg.endIndexExclusive} 段`);
    }

    // 按比例计算并进行“就近取整 + 余数分配”以满足总长 = available（尽量）
    const rawLens = slots.map(s => (s.rigid ? s.desiredMin * scaleRigid : s.desiredMin * scaleFloat));
    const floors = rawLens.map(x => Math.max(0, Math.floor(x)));
    let sumFloors = floors.reduce((a, b) => a + b, 0);
    // 分配余数以精确贴合段长（扩展或压缩场景皆可）
    let remain = Math.max(0, available - sumFloors);
    const remainders = rawLens.map((x, idx) => ({ idx, frac: x - floors[idx] }));
    remainders.sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainders.length && remain > 0; k++) {
      floors[remainders[k].idx] += 1;
      remain--;
    }
    // 赋值 start/len
    let cursor = seg.startAbs;
    for (let local = 0; local < slots.length; local++) {
      const globalIdx = seg.startIndex + local;
      // 若该段首槽拥有固定开始，则强行对齐
      if (local === 0 && fixedMap.has(seg.startIndex)) {
        cursor = seg.startAbs;
      }
      actStart[globalIdx] = cursor;
      actLen[globalIdx] = floors[local];
      cursor += floors[local];
    }
  }

  // 汇总结果
  const resultSlots: DaySlot[] = template.slots.map((s, idx) => {
    const opt = optSlots[idx];
    const start = actStart[idx] || dayStartAbs;
    const len = actLen[idx] || 0;
    const percent = (opt.optLen > 0) ? (len / opt.optLen) : 1;
    const delay = (start - opt.optStart);
    return {
      ...s,
      optLen: opt.optLen,
      optStart: opt.optStart,
      actLen: len,
      start,
      percent,
      delay,
    };
  });

  return {
    wakeStart: template.wakeStart,
    totalHours: template.totalHours,
    slots: resultSlots,
    warnings,
  };
}
