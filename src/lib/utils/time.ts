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

// 将全角数字/冒号转为半角，并去除空白
function normalizeFullWidth(input: string): string {
  const fwDigits = '０１２３４５６７８９：';
  const hwDigits = '0123456789:';
  let out = '';
  for (const ch of input.trim()) {
    const idx = fwDigits.indexOf(ch);
    out += idx >= 0 ? hwDigits[idx] : ch;
  }
  return out.replace(/[\s]/g, '');
}

// 宽松解析：接受 9 → 09:00，930/0930 → 09:30，9:3 → 09:03，9：30 → 09:30
export function parseHmLoose(input: string): string | null {
  if (!input) return null;
  const s = normalizeFullWidth(input);
  // 明确 HH:mm
  const m1 = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m1) {
    let h = Math.min(23, Math.max(0, parseInt(m1[1] || '0', 10) || 0));
    let mm = Math.min(59, Math.max(0, parseInt(m1[2] || '0', 10) || 0));
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  // 纯数字：H、HH、Hmm、HHmm
  const m2 = s.match(/^(\d{1,4})$/);
  if (m2) {
    const num = m2[1];
    if (num.length <= 2) {
      const h = Math.min(23, Math.max(0, parseInt(num, 10) || 0));
      return `${String(h).padStart(2, '0')}:00`;
    }
    const hh = num.slice(0, num.length - 2);
    const mm = num.slice(-2);
    const h = Math.min(23, Math.max(0, parseInt(hh, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(mm, 10) || 0));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // H:、HH: 视为整点
  const m3 = s.match(/^(\d{1,2}):$/);
  if (m3) {
    const h = Math.min(23, Math.max(0, parseInt(m3[1] || '0', 10) || 0));
    return `${String(h).padStart(2, '0')}:00`;
  }
  return null;
}
