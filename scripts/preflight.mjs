#!/usr/bin/env node
/* Preflight checks for Prisma & env */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const prismaClientIndex = path.join(root, 'node_modules', '.prisma', 'client', 'index.js');

function log(msg) { console.log(`[preflight] ${msg}`); }
function warn(msg) { console.warn(`[preflight] ⚠ ${msg}`); }

// 1) .env presence
if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    warn('.env 不存在。请先运行: cp .env.example .env');
  } else {
    warn('.env.example 不存在（预期在仓库根目录）。请创建 .env 并设置 DATABASE_URL');
  }
}

// 2) DATABASE_URL presence
if (!process.env.DATABASE_URL) {
  // Try load .env manually to improve local DX (without dotenv)
  try {
    const t = fs.readFileSync(envPath, 'utf8');
    if (!/DATABASE_URL=/.test(t)) {
      warn('环境变量 DATABASE_URL 未设置。默认用于本地 SQLite，例如: DATABASE_URL="file:./prisma/dev.db"');
    }
  } catch {
    // ignore
  }
}

// 3) Prisma client generation check
let needGenerate = false;
if (!fs.existsSync(prismaClientIndex)) {
  needGenerate = true;
} else if (fs.existsSync(schemaPath)) {
  try {
    const stSchema = fs.statSync(schemaPath);
    const stClient = fs.statSync(prismaClientIndex);
    if (stClient.mtimeMs < stSchema.mtimeMs) needGenerate = true;
  } catch {}
}

if (needGenerate) {
  log('Prisma Client 可能未生成或已过期，正在执行 prisma generate ...');
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
  } catch (e) {
    warn('prisma generate 执行失败，请手动运行: npm run prisma:generate');
  }
}

// 4) Quick DB existence hint for SQLite (robust parsing)
try {
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  let url = process.env.DATABASE_URL || '';
  if (!url) {
    const m = envText.match(/DATABASE_URL\s*=\s*(?:"([^"]+)"|([^\r\n]+))/);
    url = ((m && (m[1] || m[2])) || '').trim();
  }
  if (url && url.startsWith('file:')) {
    const relFile = url.replace(/^file:/, '').replace(/^"|"$/g, '').trim();
    const dbPath = path.isAbsolute(relFile) ? relFile : path.join(root, relFile);
    const exists = fs.existsSync(dbPath);
    if (!exists) {
      warn(`SQLite 数据库文件未找到: ${dbPath}\n  如为首次初始化，请运行: npm run db:setup`);
      const misplaced = path.join(root, 'prisma', 'prisma', path.basename(dbPath));
      if (fs.existsSync(misplaced)) {
        warn(`检测到疑似误放的数据库文件: ${misplaced}\n  请将其移动到: ${dbPath}\n  示例: mv prisma/prisma/${path.basename(dbPath)} prisma/${path.basename(dbPath)}`);
      }
    } else {
      log(`已检测到 SQLite 数据库文件: ${dbPath}`);
    }
  }
} catch {}
