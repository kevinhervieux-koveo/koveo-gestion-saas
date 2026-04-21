#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildManifest, serializeManifest } from './lib/scan-server-routes';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(scriptDir, '..', 'server', 'route-manifest.json');

function main() {
  const check = process.argv.includes('--check');
  const manifest = buildManifest();
  const serialized = serializeManifest(manifest);

  if (check) {
    if (!fs.existsSync(manifestPath)) {
      console.error(
        `[route-manifest] ${manifestPath} is missing. Run \`npx tsx scripts/generate-route-manifest.ts\` to create it.`
      );
      process.exit(1);
    }
    const existing = fs.readFileSync(manifestPath, 'utf-8');
    if (existing !== serialized) {
      console.error(
        '[route-manifest] Route manifest is out of date.\n' +
          'Run `npx tsx scripts/generate-route-manifest.ts` and commit the updated server/route-manifest.json.'
      );
      process.exit(1);
    }
    console.log(
      `[route-manifest] OK - ${manifest.totals.allRoutes} routes (${manifest.totals.apiWriteRoutes} demo-guarded writes).`
    );
    return;
  }

  fs.writeFileSync(manifestPath, serialized, 'utf-8');
  console.log(
    `[route-manifest] Wrote ${manifestPath} (${manifest.totals.allRoutes} routes, ${manifest.totals.writeRoutes} writes, ${manifest.totals.apiWriteRoutes} demo-guarded).`
  );
}

main();
