#!/usr/bin/env tsx

/**
 * Writes `dist/build-info.json` with the current commit's short SHA and the
 * build timestamp. The MCP `get_mcp_info` tool reads this file at runtime so
 * support can verify, from outside the long-lived MCP process, which commit
 * the deployed bundle was built from.
 *
 * Resolution order:
 *   1. `BUILD_SHA` / `BUILD_TIME` env vars (lets the deploy pipeline override)
 *   2. `git rev-parse --short HEAD` and the current ISO timestamp
 *   3. The literal "unknown" / current ISO timestamp (last-resort fallback
 *      for environments where git is unavailable, e.g. a shallow container)
 *
 * Fail-fast: when running in a production build (NODE_ENV=production) or when
 * `--fail-on-unknown` is passed, exit non-zero if the resolver could only
 * produce `"unknown"`. This converts a silent bad value into a visible build
 * failure so a deploy can never ship without a real build SHA.
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

function resolveSha(): string {
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
}

function resolveTime(): string {
  if (process.env.BUILD_TIME) {
    return process.env.BUILD_TIME;
  }
  return new Date().toISOString();
}

const buildSha = resolveSha();
const buildTime = resolveTime();

const failOnUnknown =
  process.argv.includes('--fail-on-unknown') ||
  process.env.NODE_ENV === 'production';

if ((!buildSha || buildSha === 'unknown') && failOnUnknown) {
  console.error(
    '❌ write-build-info: refusing to stamp build-info.json with buildSha="unknown".\n' +
      '   Set BUILD_SHA in the build environment, or run the build from a checkout\n' +
      '   where `git rev-parse --short HEAD` succeeds. Aborting build.',
  );
  process.exit(1);
}

const outFile = resolve(process.cwd(), 'dist', 'build-info.json');
const payload = {
  buildSha,
  buildTime,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.warn(`📌 Wrote ${outFile}: ${JSON.stringify(payload)}`);
