'use client';

import { useEffect, useState } from 'react';
import { getScheduleByDate } from '@/lib/client/schedules';
import Link from 'next/link';
import { formatClock } from '@/lib/utils/time';

export default function DataDetailPage({ params }: { params: { date: string } }) {
  const { date } = params;
  const [row, setRow] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const s = await getScheduleByDate(date);
        setRow(s);
      } catch (e) {
        setErr('加载失败');
      }
    })();
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/data" className="text-sm text-gray-600 border px-2 py-1 rounded">返回</Link>
        <h1 className="text-xl font-semibold">{date} 当日计划</h1>
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      {!row ? null : (
        <>
          <div className="text-sm text-gray-700">{row.name} · 起点 {row.wakeStart} · 总小时 {row.totalHours}</div>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1">序</th>
                  <th className="border px-2 py-1 text-left">开始</th>
                  <th className="border px-2 py-1 text-left">标题</th>
                  <th className="border px-2 py-1">期望</th>
                  <th className="border px-2 py-1">实际</th>
                  <th className="border px-2 py-1">F/R</th>
                </tr>
              </thead>
              <tbody>
                {row.slots?.map((s: any, i: number) => (
                  <tr key={s.id}>
                    <td className="border px-2 py-1">{i + 1}</td>
                    <td className="border px-2 py-1">{formatClock(s.start)}</td>
                    <td className="border px-2 py-1">{s.title}</td>
                    <td className="border px-2 py-1 text-right">{s.desiredMin}</td>
                    <td className="border px-2 py-1 text-right">{s.actLen}</td>
                    <td className="border px-2 py-1 text-center">{s.rigid ? 'R' : 'F'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

