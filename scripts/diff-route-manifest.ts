#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildManifest,
  type RouteManifest,
} from './lib/scan-server-routes';
import { buildReport } from './lib/diff-route-manifest-report';

export { buildReport };

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultCurrentPath = path.resolve(scriptDir, '..', 'server', 'route-manifest.json');

interface CliOptions {
  basePath: string | null;
  currentPath: string | null;
  outPath: string | null;
  stale: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    basePath: null,
    currentPath: null,
    outPath: null,
    stale: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base' && argv[i + 1]) {
      opts.basePath = argv[++i];
    } else if (a === '--current' && argv[i + 1]) {
      opts.currentPath = argv[++i];
    } else if (a === '--out' && argv[i + 1]) {
      opts.outPath = argv[++i];
    } else if (a === '--stale') {
      opts.stale = true;
    }
  }
  return opts;
}

function readManifest(p: string | null): RouteManifest | null {
  if (!p) return null;
  if (!fs.existsSync(p)) return null;
  try {
    const txt = fs.readFileSync(p, 'utf-8');
    return JSON.parse(txt) as RouteManifest;
  } catch {
    return null;
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const currentPath = opts.currentPath ?? defaultCurrentPath;
  let current: RouteManifest;
  try {
    current = buildManifest();
  } catch {
    const fromDisk = readManifest(currentPath);
    if (!fromDisk) {
      console.error(
        `[diff-route-manifest] Unable to build manifest from source and no file at ${currentPath}.`
      );
      process.exit(1);
    }
    current = fromDisk;
  }

  const base = readManifest(opts.basePath);
  const report = buildReport(base, current, opts.stale);

  if (opts.outPath) {
    fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
    fs.writeFileSync(opts.outPath, report, 'utf-8');
  } else {
    process.stdout.write(report);
  }
}

main();
