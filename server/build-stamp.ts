/**
 * Shared build-stamp resolver consumed by both the MCP `get_mcp_info` tool
 * and the `/api/health` HTTP endpoint.
 *
 * Resolution order (real per-build stamp first, dev fallback last):
 *   1. `dist/build-info.json` written by `scripts/write-build-info.ts`
 *      during the production build. Authoritative when present.
 *   2. `BUILD_SHA` / `BUILD_TIME` env vars — lets a deploy pipeline inject
 *      the stamp without writing a file.
 *   3. `git rev-parse --short HEAD` and the current ISO timestamp — used in
 *      local `npm run dev` and any container where `.git` is available.
 *   4. The literal string `"unknown"` (SHA) / current ISO timestamp (time).
 *
 * The resolver runs synchronously and is cached at module load so every
 * consumer in the same process sees the same value.
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

type BuildStamp = { buildSha?: unknown; buildTime?: unknown };

function readBuildStampFile(): BuildStamp {
  const file = join(process.cwd(), 'dist', 'build-info.json');
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as BuildStamp;
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // No stamp file (e.g. dev mode) — fall through to env / git resolution.
  }
  return {};
}

const BUILD_STAMP = readBuildStampFile();

export const BUILD_SHA: string = (() => {
  if (typeof BUILD_STAMP.buildSha === 'string' && BUILD_STAMP.buildSha) {
    return BUILD_STAMP.buildSha;
  }
  if (process.env.BUILD_SHA) {
    return process.env.BUILD_SHA;
  }
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
})();

export const BUILD_TIME: string = (() => {
  if (typeof BUILD_STAMP.buildTime === 'string' && BUILD_STAMP.buildTime) {
    return BUILD_STAMP.buildTime;
  }
  if (process.env.BUILD_TIME) {
    return process.env.BUILD_TIME;
  }
  return new Date().toISOString();
})();
