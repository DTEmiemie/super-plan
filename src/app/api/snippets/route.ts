import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { configureSQLite } from '@/lib/server/sqlite';

export const dynamic = 'force-dynamic';

export async function GET() {
  await configureSQLite();
  const list = await prisma.snippet.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  await configureSQLite();
  const body = await req.json();
  const { title, desiredMin, rigid } = body || {};
  if (!title || typeof desiredMin !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const created = await prisma.snippet.create({ data: { title, desiredMin, rigid: !!rigid } });
  return NextResponse.json(created, { status: 201 });
}

