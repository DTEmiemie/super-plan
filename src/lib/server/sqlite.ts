import { prisma } from '@/lib/server/db';

let configured = false;

export async function configureSQLite(): Promise<void> {
  if (configured) return;
  const url = process.env.DATABASE_URL || '';
  // Only attempt for SQLite (file: URL)
  if (!url.startsWith('file:') && !url.includes('mode=sqlite')) {
    configured = true;
    return;
  }
  try {
    // Set Write-Ahead Logging and relaxed sync for better perf in dev
    await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;');
    await prisma.$executeRawUnsafe('PRAGMA synchronous=NORMAL;');
  } catch {
    // ignore errors; not fatal
  } finally {
    configured = true;
  }
}

