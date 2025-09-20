#!/usr/bin/env bash
set -euo pipefail

echo "[pre-push] Type check (tsc)"
npm run lint

echo "[pre-push] Unit tests (Vitest --run)"
npm run test -- --run

echo "[pre-push] Build (Next.js production build)"
npm run build

echo "[pre-push] OK"

