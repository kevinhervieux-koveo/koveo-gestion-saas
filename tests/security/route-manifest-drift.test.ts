import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  buildManifest,
  serializeManifest,
  isExemptPath,
  WRITE_METHODS,
  type RouteManifest,
} from '../../scripts/lib/scan-server-routes';

const serverDir = path.resolve(__dirname, '../../server');
const manifestPath = path.join(serverDir, 'route-manifest.json');

describe('Route manifest drift guard', () => {
  it('server/route-manifest.json exists and is valid JSON', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('manifest matches the current source tree (regenerate with `npx tsx scripts/generate-route-manifest.ts`)', () => {
    const existing = fs.readFileSync(manifestPath, 'utf-8');
    const fresh = serializeManifest(buildManifest(serverDir));

    if (existing !== fresh) {
      const existingParsed: RouteManifest = JSON.parse(existing);
      const freshParsed: RouteManifest = JSON.parse(fresh);

      const existingKeys = new Set(
        existingParsed.routes.map((r) => `${r.method} ${r.path} (${r.file})`)
      );
      const freshKeys = new Set(
        freshParsed.routes.map((r) => `${r.method} ${r.path} (${r.file})`)
      );

      const added = [...freshKeys].filter((k) => !existingKeys.has(k));
      const removed = [...existingKeys].filter((k) => !freshKeys.has(k));

      const details: string[] = [];
      if (added.length > 0) details.push(`Added routes:\n  ${added.join('\n  ')}`);
      if (removed.length > 0)
        details.push(`Removed routes:\n  ${removed.join('\n  ')}`);
      if (details.length === 0)
        details.push('Route totals or ordering changed without added/removed entries.');

      throw new Error(
        'Route manifest is out of date.\n' +
          details.join('\n') +
          '\n\nRegenerate: `npx tsx scripts/generate-route-manifest.ts`\n' +
          'Then commit the updated server/route-manifest.json.'
      );
    }
  });

  it('every manifest write route outside /api/* is on the explicit exempt list', () => {
    const manifest: RouteManifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf-8')
    );

    const writesOutsideApi = manifest.routes.filter(
      (r) => WRITE_METHODS.includes(r.method) && !r.path.startsWith('/api/')
    );
    const unaccountedFor = writesOutsideApi.filter((r) => !isExemptPath(r.path));

    if (unaccountedFor.length > 0) {
      throw new Error(
        `${unaccountedFor.length} write route(s) live outside /api/* and are not on the AUTH/MCP exempt list:\n` +
          unaccountedFor
            .map((r) => `  ${r.method} ${r.path} (${r.file})`)
            .join('\n') +
          '\nEither mount them under /api/ so the global enforceDemoSecurity() middleware applies, ' +
          'or add them to AUTH_PATHS/MCP_PATHS in scripts/lib/scan-server-routes.ts if they are intentionally public.'
      );
    }
  });

  it('manifest paths are well-formed string literals (no template/substitution leakage)', () => {
    const manifest: RouteManifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf-8')
    );

    const bad = manifest.routes.filter((r) => {
      if (!r.path.startsWith('/')) return true;
      if (/[\n\r`${}]/.test(r.path)) return true;
      if (/\s{2,}/.test(r.path)) return true;
      return false;
    });

    if (bad.length > 0) {
      throw new Error(
        `Manifest contains ${bad.length} malformed route path(s) (likely scanner regression):\n` +
          bad.map((r) => `  ${r.method} ${JSON.stringify(r.path)} (${r.file})`).join('\n')
      );
    }
  });

  it('manifest totals are sane (keeps baseline from collapsing silently)', () => {
    const manifest: RouteManifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf-8')
    );
    expect(manifest.totals.allRoutes).toBeGreaterThanOrEqual(50);
    expect(manifest.totals.writeRoutes).toBeGreaterThanOrEqual(30);
    expect(manifest.totals.apiWriteRoutes).toBeGreaterThanOrEqual(30);
    expect(manifest.routes.length).toBe(manifest.totals.allRoutes);
  });
});
