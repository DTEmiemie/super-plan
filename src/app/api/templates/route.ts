import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { configureSQLite } from '@/lib/server/sqlite';
import { TemplateInput, encodeTags, decodeTags } from '@/lib/api/dto';

export async function GET() {
  await configureSQLite();
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'asc' },
    include: { slots: { orderBy: { index: 'asc' } } },
  });
  const mapped = templates.map((t: any) => ({
    ...t,
    slots: (t.slots || []).map((s: any) => ({ ...s, tags: decodeTags(s.tags) })),
  }));
  return NextResponse.json(mapped);
}

export async function POST(req: Request) {
  await configureSQLite();
  const data = await req.json();
  let parsed;
  try {
    parsed = TemplateInput.parse(data);
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid payload', details: e?.errors || String(e) }, { status: 400 });
  }
  const created = await prisma.template.create({
    data: {
      name: parsed.name,
      wakeStart: parsed.wakeStart,
      totalHours: parsed.totalHours,
      slots: {
        create: (parsed.slots || []).map((s, i) => ({
          index: s.index ?? i,
          title: s.title ?? '未命名',
          desiredMin: typeof s.desiredMin === 'number' ? s.desiredMin : 0,
          rigid: !!s.rigid,
          fixedStart: s.fixedStart ?? null,
          tags: encodeTags(s.tags),
        })),
      },
    },
    include: { slots: { orderBy: { index: 'asc' } } },
  });
  const mapped = { ...created, slots: created.slots.map((s: any) => ({ ...s, tags: decodeTags(s.tags) })) };
  return NextResponse.json(mapped, { status: 201 });
}
export const dynamic = 'force-dynamic';
