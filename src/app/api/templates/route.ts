import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { configureSQLite } from '@/lib/server/sqlite';

export async function GET() {
  await configureSQLite();
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'asc' },
    include: { slots: { orderBy: { index: 'asc' } } },
  });
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  await configureSQLite();
  const data = await req.json();
  const { name, wakeStart, totalHours, slots } = data;
  if (!name || !wakeStart || typeof totalHours !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const created = await prisma.template.create({
    data: {
      name,
      wakeStart,
      totalHours,
      slots: {
        create: (Array.isArray(slots) ? slots : []).map((s: any, i: number) => ({
          index: s.index ?? i,
          title: s.title ?? '未命名',
          desiredMin: typeof s.desiredMin === 'number' ? s.desiredMin : 0,
          rigid: !!s.rigid,
          fixedStart: s.fixedStart ?? null,
          tags: s.tags ?? null,
        })),
      },
    },
    include: { slots: { orderBy: { index: 'asc' } } },
  });
  return NextResponse.json(created, { status: 201 });
}
export const dynamic = 'force-dynamic';
