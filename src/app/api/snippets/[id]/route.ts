import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { configureSQLite } from '@/lib/server/sqlite';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await configureSQLite();
  const id = params.id;
  const body = await req.json();
  const { title, desiredMin, rigid } = body || {};
  const updated = await prisma.snippet.update({ where: { id }, data: { title, desiredMin, rigid: !!rigid } });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await configureSQLite();
  const id = params.id;
  await prisma.snippet.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

