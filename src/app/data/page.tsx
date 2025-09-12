'use client';

import { useEffect, useState } from 'react';
import { listSchedules } from '@/lib/client/schedules';
import Link from 'next/link';

export default function DataPage() {
  const [rows, setRows] = useState<Array<{ id: string; date: string; name: string; wakeStart: string; totalHours: number }>>([]);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const list = await listSchedules();
        setRows(list);
      } catch (e) {
        setErr('读取历史计划失败');
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">数据管理</h1>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2 py-1 text-left">日期</th>
              <th className="border px-2 py-1 text-left">名称</th>
              <th className="border px-2 py-1">起点</th>
              <th className="border px-2 py-1">总小时</th>
              <th className="border px-2 py-1">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="border px-2 py-1">{r.date}</td>
                <td className="border px-2 py-1">{r.name}</td>
                <td className="border px-2 py-1 text-center">{r.wakeStart}</td>
                <td className="border px-2 py-1 text-center">{r.totalHours}</td>
                <td className="border px-2 py-1">
                  <Link className="px-2 py-1 border rounded" href={`/data/${r.date}`}>查看</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

