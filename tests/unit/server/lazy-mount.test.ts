/**
 * @jest-environment node
 *
 * Smoke test for `server/utils/lazy-mount.ts`.
 *
 * Task #453 — Lock the load-once + concurrent-safety contract that the
 * lazy-mount trampoline gives heavy modules (e.g. the MCP server). A
 * future refactor that accidentally awaits the loader at boot, drops the
 * shared in-flight promise, or re-imports on every request will fail
 * here instead of silently regressing production boot memory.
 *
 * The test exercises the helper directly with a fake loader so it
 * doesn't depend on the actual MCP module graph (which is heavy and
 * environment-sensitive). The four assertions map to the four bullets
 * in the task's "Done looks like":
 *
 *   1. Loader NOT invoked after route registration (no boot-time import).
 *   2. First matching request triggers exactly one loader call.
 *   3. A concurrent burst of first requests shares a single load promise.
 *   4. Subsequent requests bypass the trampoline (loader call count stays).
 */

import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';

import {
  lazyMount,
  type RouteRegistrar,
} from '../../../server/utils/lazy-mount';

interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

function listen(app: express.Express): Promise<RunningServer> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      );
    });
    req.on('error', reject);
  });
}

function pingRegistrar(): RouteRegistrar {
  return (registry) => {
    registry.get('/lazy/ping', (_req, res) => res.json({ ok: true }));
  };
}

describe('lazyMount — load-once + concurrent-safe contract', () => {
  it('does not invoke the loader at registration time', async () => {
    const loader = jest.fn(async () => pingRegistrar());

    const app = express();
    lazyMount(app, '/lazy', loader);

    // Give the event loop a tick to prove no microtask scheduled the load.
    await new Promise((r) => setImmediate(r));

    expect(loader).not.toHaveBeenCalled();
  });

  it('triggers exactly one dynamic import on the first matching request', async () => {
    const loader = jest.fn(async () => pingRegistrar());

    const app = express();
    lazyMount(app, '/lazy', loader);
    const server = await listen(app);

    try {
      const res = await get(`${server.url}/lazy/ping`);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true });
      expect(loader).toHaveBeenCalledTimes(1);
    } finally {
      await server.close();
    }
  });

  it('does not invoke the loader for non-matching requests', async () => {
    const loader = jest.fn(async () => pingRegistrar());

    const app = express();
    app.get('/other', (_req, res) => res.json({ other: true }));
    lazyMount(app, '/lazy', loader);
    const server = await listen(app);

    try {
      const res = await get(`${server.url}/other`);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ other: true });
      expect(loader).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('shares a single load promise across a concurrent first-request burst', async () => {
    let resolveLoad: ((r: RouteRegistrar) => void) | null = null;
    const loader = jest.fn(
      () =>
        new Promise<RouteRegistrar>((resolve) => {
          resolveLoad = (r) => resolve(r);
        })
    );

    const app = express();
    lazyMount(app, '/lazy', loader);
    const server = await listen(app);

    try {
      // Fire 10 concurrent requests BEFORE the loader resolves.
      const inflight = Array.from({ length: 10 }, () =>
        get(`${server.url}/lazy/ping`)
      );

      // Yield enough turns for express to dispatch all 10 into the trampoline.
      for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));

      expect(loader).toHaveBeenCalledTimes(1);

      // Now resolve the single in-flight load.
      resolveLoad!(pingRegistrar());

      const responses = await Promise.all(inflight);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ ok: true });
      }

      // Still exactly one import despite 10 concurrent first requests.
      expect(loader).toHaveBeenCalledTimes(1);
    } finally {
      await server.close();
    }
  });

  it('bypasses the trampoline on subsequent requests', async () => {
    const loader = jest.fn(async () => pingRegistrar());

    const app = express();
    lazyMount(app, '/lazy', loader);
    const server = await listen(app);

    try {
      // Warm the trampoline.
      await get(`${server.url}/lazy/ping`);
      expect(loader).toHaveBeenCalledTimes(1);

      // 25 sequential subsequent requests — none should re-import.
      for (let i = 0; i < 25; i++) {
        const res = await get(`${server.url}/lazy/ping`);
        expect(res.status).toBe(200);
      }

      expect(loader).toHaveBeenCalledTimes(1);

      // And another concurrent burst after warmup also doesn't re-import.
      await Promise.all(
        Array.from({ length: 10 }, () => get(`${server.url}/lazy/ping`))
      );
      expect(loader).toHaveBeenCalledTimes(1);
    } finally {
      await server.close();
    }
  });
});
