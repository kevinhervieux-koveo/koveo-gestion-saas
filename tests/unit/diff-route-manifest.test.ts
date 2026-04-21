import { describe, it, expect } from '@jest/globals';
import { buildReport } from '../../scripts/lib/diff-route-manifest-report';
import {
  AUTH_PATHS,
  WRITE_METHODS,
  isExemptPath,
  type DiscoveredRoute,
  type RouteManifest,
} from '../../scripts/lib/scan-server-routes';

function manifest(routes: DiscoveredRoute[]): RouteManifest {
  const writes = routes.filter((r) => WRITE_METHODS.includes(r.method));
  const apiWrites = writes.filter((r) => !isExemptPath(r.path));
  return {
    generatedBy: 'test',
    description: 'test manifest',
    totals: {
      allRoutes: routes.length,
      writeRoutes: writes.length,
      apiWriteRoutes: apiWrites.length,
    },
    routes,
  };
}

const baseline: DiscoveredRoute[] = [
  { method: 'GET', path: '/api/users', file: 'api/users.ts' },
  { method: 'POST', path: '/api/users', file: 'api/users.ts' },
];

describe('diff-route-manifest buildReport', () => {
  it('reports no changes when base and current are identical', () => {
    const report = buildReport(manifest(baseline), manifest(baseline), false);
    expect(report).toContain('_No route changes detected._');
    expect(report).not.toContain(':rotating_light:');
    expect(report).not.toContain(':heavy_plus_sign:');
    expect(report).not.toContain(':heavy_minus_sign:');
    expect(report).not.toContain('Manifest is out of date');
  });

  it('lists added routes without flagging a guarded /api write as unguarded', () => {
    const added: DiscoveredRoute = {
      method: 'POST',
      path: '/api/buildings',
      file: 'api/buildings.ts',
    };
    const report = buildReport(
      manifest(baseline),
      manifest([...baseline, added]),
      false,
    );
    expect(report).toContain(':heavy_plus_sign: Added routes (1)');
    expect(report).toContain('`/api/buildings`');
    // Guarded /api writes must never trigger the unguarded section.
    expect(report).not.toContain(':rotating_light:');
    expect(report).not.toMatch(/:warning: unguarded write/);
  });

  it('flags a newly-added exempt-path write in the :rotating_light: section', () => {
    // AUTH_PATHS entries are in the exempt list; re-adding one as a write
    // should light up as unguarded even though it is under /api.
    const newExemptWrite: DiscoveredRoute = {
      method: 'POST',
      path: AUTH_PATHS[0],
      file: 'api/auth.ts',
    };
    expect(isExemptPath(newExemptWrite.path)).toBe(true);

    const report = buildReport(
      manifest(baseline),
      manifest([...baseline, newExemptWrite]),
      false,
    );
    expect(report).toContain(
      ':rotating_light: 1 new write route(s) missing the demo-mode guard',
    );
    // Reason column must say "exempt path" for /api exempt entries.
    const escapedPath = newExemptWrite.path.replace(/\//g, '\\/');
    expect(report).toMatch(
      new RegExp(`\\| \`POST\` \\| \`${escapedPath}\` \\|.*\\| exempt path \\|`),
    );
    // And the added row should carry the inline warning marker.
    expect(report).toMatch(/:warning: unguarded write/);
  });

  it('flags a newly-added non-/api write as unguarded with "not under `/api`"', () => {
    const newNonApiWrite: DiscoveredRoute = {
      method: 'PUT',
      path: '/webhooks/inbound',
      file: 'routes.ts',
    };
    const report = buildReport(
      manifest(baseline),
      manifest([...baseline, newNonApiWrite]),
      false,
    );
    expect(report).toContain(':rotating_light:');
    expect(report).toMatch(
      /\| `PUT` \| `\/webhooks\/inbound` \|.*\| not under `\/api` \|/,
    );
  });

  it('renders the stale manifest banner when --stale is set', () => {
    const report = buildReport(manifest(baseline), manifest(baseline), true);
    expect(report).toContain('Manifest is out of date');
    expect(report).toContain(
      'npx tsx scripts/generate-route-manifest.ts',
    );
  });

  it('shows removed routes when the current manifest drops entries', () => {
    const report = buildReport(
      manifest(baseline),
      manifest([baseline[0]]),
      false,
    );
    expect(report).toContain(':heavy_minus_sign: Removed routes (1)');
    expect(report).toContain('`POST`');
  });

  // Snapshot tests lock the *full* PR comment markdown so that any change to
  // section ordering, table headers, totals row order, or footer wording fails
  // CI on purpose. To intentionally accept a formatting change, re-run jest
  // with `--updateSnapshot` and review the diff in the PR.
  it('matches snapshot for the "no changes" PR comment', () => {
    const report = buildReport(manifest(baseline), manifest(baseline), false);
    expect(report).toMatchSnapshot();
  });

  it('matches snapshot for an added + removed + unguarded-write PR comment', () => {
    const baseRoutes: DiscoveredRoute[] = [
      { method: 'GET', path: '/api/users', file: 'api/users.ts' },
      { method: 'POST', path: '/api/users', file: 'api/users.ts' },
      { method: 'DELETE', path: '/api/legacy', file: 'api/legacy.ts' },
    ];
    const currentRoutes: DiscoveredRoute[] = [
      { method: 'GET', path: '/api/users', file: 'api/users.ts' },
      { method: 'POST', path: '/api/users', file: 'api/users.ts' },
      // newly added guarded /api write
      { method: 'POST', path: '/api/buildings', file: 'api/buildings.ts' },
      // newly added unguarded non-/api write
      { method: 'PUT', path: '/webhooks/inbound', file: 'routes.ts' },
      // newly added unguarded exempt-path write
      { method: 'POST', path: AUTH_PATHS[0], file: 'api/auth.ts' },
    ];
    const report = buildReport(
      manifest(baseRoutes),
      manifest(currentRoutes),
      false,
    );
    expect(report).toMatchSnapshot();
  });
});

describe('scan-server-routes invariants the diff report depends on', () => {
  it('WRITE_METHODS covers the four mutating HTTP verbs', () => {
    // If this list changes, the diff report\'s detection logic changes too —
    // updating WRITE_METHODS silently must fail at least this assertion.
    expect(new Set(WRITE_METHODS)).toEqual(
      new Set(['POST', 'PUT', 'PATCH', 'DELETE']),
    );
  });

  it('isExemptPath treats auth paths, non-/api, /api/test, MCP, and trial-requests as exempt', () => {
    for (const p of AUTH_PATHS) expect(isExemptPath(p)).toBe(true);
    expect(isExemptPath('/mcp')).toBe(true);
    expect(isExemptPath('/api/test')).toBe(true);
    expect(isExemptPath('/api/trial-requests')).toBe(true);
    expect(isExemptPath('/webhooks/x')).toBe(true);
    // A regular /api route must NOT be exempt — otherwise the whole
    // unguarded-write detection collapses.
    expect(isExemptPath('/api/buildings')).toBe(false);
    expect(isExemptPath('/api/users')).toBe(false);
  });
});
