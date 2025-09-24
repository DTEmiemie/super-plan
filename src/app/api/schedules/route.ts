import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { configureSQLite } from '@/lib/server/sqlite';
import { ScheduleInput } from '@/lib/api/dto';

// List schedules or get by date via query ?date=YYYY-MM-DD
export async function GET(req: Request) {
  await configureSQLite();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (date) {
    const sch = await prisma.schedule.findUnique({
      where: { date },
      include: { slots: { orderBy: { index: 'asc' } } },
    });
    if (!sch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(sch);
  }
  const list = await prisma.schedule.findMany({
    orderBy: { date: 'desc' },
    take: 30,
    select: { id: true, date: true, name: true, wakeStart: true, totalHours: true, createdAt: true },
  });
  return NextResponse.json(list);
}

// Upsert schedule for a date
export async function POST(req: Request) {
  await configureSQLite();
  const body = await req.json();
  let parsed;
  try {
    parsed = ScheduleInput.parse(body || {});
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid payload', details: e?.errors || String(e) }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.schedule.findUnique({ where: { date: parsed.date } });
    const schedule = existing
      ? await tx.schedule.update({ where: { date: parsed.date }, data: { name: parsed.name, wakeStart: parsed.wakeStart, totalHours: parsed.totalHours, templateId: parsed.templateId ?? null } })
      : await tx.schedule.create({ data: { date: parsed.date, name: parsed.name, wakeStart: parsed.wakeStart, totalHours: parsed.totalHours, templateId: parsed.templateId ?? null } });

    await tx.scheduleSlot.deleteMany({ where: { scheduleId: schedule.id } });
    for (let i = 0; i < parsed.slots.length; i++) {
      const s = parsed.slots[i];
      await tx.scheduleSlot.create({
        data: {
          scheduleId: schedule.id,
          index: s.index ?? i,
          title: s.title ?? '未命名',
          desiredMin: typeof s.desiredMin === 'number' ? s.desiredMin : 0,
          rigid: !!s.rigid,
          fixedStart: s.fixedStart ?? null,
          optLen: Math.round(s.optLen ?? 0),
          optStart: Math.round(s.optStart ?? 0),
          actLen: Math.round(s.actLen ?? 0),
          start: Math.round(s.start ?? 0),
        },
      });
    }
    const fresh = await tx.schedule.findUnique({ where: { date: parsed.date }, include: { slots: { orderBy: { index: 'asc' } } } });
    return fresh;
  });
  return NextResponse.json(result, { status: 201 });
}
export const dynamic = 'force-dynamic';
