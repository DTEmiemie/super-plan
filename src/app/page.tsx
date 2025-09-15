'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">欢迎使用 super-plan（演示版）</h1>
      <p className="text-gray-700">
        这是对 SuperMemo「Plan」的最小可运行前端：包含模板编辑与“今日执行”。
      </p>
      <div className="flex gap-4">
        <Link href="/today" className="px-3 py-2 rounded bg-black text-white">前往今日执行</Link>
        <Link href="/templates" className="px-3 py-2 rounded border">前往模板</Link>
      </div>
      <ul className="list-disc pl-6 text-sm text-gray-600">
        <li>数据存储：浏览器 localStorage（演示用）。</li>
        <li>调度计算：纯函数（简化版），支持按比例压缩。</li>
        <li>后续将补齐固定起点、刚性与延迟分析等完整逻辑。</li>
      </ul>
    </div>
  );
}
