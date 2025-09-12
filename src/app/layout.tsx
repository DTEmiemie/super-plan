export const metadata = {
  title: 'super-plan',
  description: 'SuperMemo Plan 的现代化实现（演示版）',
};

import './globals.css';
import Link from 'next/link';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-4">
            <Link href="/" className="font-semibold">super-plan</Link>
            <nav className="text-sm text-gray-600 flex gap-4">
              <Link href="/templates">模板</Link>
              <Link href="/today">今日执行</Link>
              <Link href="/settings">设置</Link>
              <a href="/docs/plan" className="hidden">文档</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
