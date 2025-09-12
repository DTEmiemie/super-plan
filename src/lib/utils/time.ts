export function hmToMin(hm: string): number {
  const m = hm?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h * 60 + mm;
}

export function minToHm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatClock(minOffset: number): string {
  // 以 00:00 起点显示时钟
  return minToHm(minOffset);
}

