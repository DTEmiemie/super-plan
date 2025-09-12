import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { configureSQLite } from '@/lib/server/sqlite';
import { defaultSettings } from '@/lib/utils/settings';

const KEY = 'ui';

export async function GET() {
  await configureSQLite();
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return NextResponse.json(defaultSettings());
  try {
    return NextResponse.json(JSON.parse(row.value));
  } catch {
    return NextResponse.json(defaultSettings());
  }
}

export async function PUT(req: Request) {
  await configureSQLite();
  const body = await req.json();
  const value = JSON.stringify(body ?? defaultSettings());
  const saved = await prisma.setting.upsert({
    where: { key: KEY },
    update: { value },
    create: { key: KEY, value },
  });
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
}
export const dynamic = 'force-dynamic';
