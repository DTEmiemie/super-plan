import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { configureSQLite } from '@/lib/server/sqlite';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await configureSQLite();
  const tpl = await prisma.template.findUnique({
    where: { id: params.id },
    include: { slots: { orderBy: { index: 'asc' } } },
  });
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tpl);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await configureSQLite();
  const id = params.id;
  const data = await req.json();
  const { name, wakeStart, totalHours, slots } = data;
  // transactional: update template, replace slots
  const result = await prisma.$transaction(async (tx) => {
    const exists = await tx.template.findUnique({ where: { id } });
    if (!exists) throw new Error('Not found');
    await tx.template.update({ where: { id }, data: { name, wakeStart, totalHours } });
    await tx.templateSlot.deleteMany({ where: { templateId: id } });
    if (Array.isArray(slots)) {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        await tx.templateSlot.create({
          data: {
            templateId: id,
            index: s.index ?? i,
            title: s.title ?? '未命名',
            desiredMin: typeof s.desiredMin === 'number' ? s.desiredMin : 0,
            rigid: !!s.rigid,
            fixedStart: s.fixedStart ?? null,
            tags: s.tags ?? null,
          },
        });
      }
    }
    const fresh = await tx.template.findUnique({
      where: { id },
      include: { slots: { orderBy: { index: 'asc' } } },
    });
    return fresh;
  });
  return NextResponse.json(result);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await configureSQLite();
  const id = params.id;
  await prisma.template.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
export const dynamic = 'force-dynamic';
