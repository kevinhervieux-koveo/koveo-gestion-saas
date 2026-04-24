import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer, createLogger } from 'vite';
import { type Server } from 'http';
import viteConfig from '../vite.config';
import { nanoid } from 'nanoid';

const viteLogger = createLogger();

/**
 *
 * @param message
 * @param source
 */
/**
 * Log function.
 * @param message
 * @param source
 * @returns Function result.
 */
export function log(message: string, source: string | 'error' | 'warn' = 'express') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const line = `${formattedTime} [${source}] ${message}`;
  if (source === 'error') {
    console.error(line);
  } else if (source === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 *
 * @param app
 * @param server
 */
/**
 * SetupVite function.
 * @param app
 * @param server
 * @returns Function result.
 */
export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // `viteConfig` may be exported as either an object or a function (the
  // function form is required when using `defineConfig(({ command, mode }) => …)`
  // so that `command`/`mode` can vary). Spreading a function value would
  // silently drop every option (including `root`, `resolve.alias`, and
  // `plugins`), which makes Vite resolve `/src/main.tsx` against the project
  // root instead of `client/`. Always normalize to a plain object first.
  const resolvedViteConfig =
    typeof viteConfig === 'function'
      ? await (viteConfig as any)({ command: 'serve', mode: 'development' })
      : viteConfig;

  const vite = await createViteServer({
    ...resolvedViteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, _options) => {
        viteLogger.error(msg, _options);
        // "Pre-transform error: Failed to load url …" is emitted transiently
        // while Vite is still warming optimizeDeps. Vite recovers from it on
        // the next request, so killing the dev server here would just produce
        // intermittent boot failures whenever a browser races optimizeDeps.
        const text = typeof msg === 'string' ? msg : String(msg ?? '');
        if (text.includes('Pre-transform error: Failed to load url')) {
          return;
        }
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: 'custom',
  });

  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    // Skip API routes - let them be handled by API middleware
    if (req.originalUrl.startsWith('/api/')) {
      return next();
    }
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(import.meta.dirname, '..', 'client', 'index.html');

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, 'utf-8');
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page);
    } catch (___e) {
      vite.ssrFixStacktrace(___e as Error);
      next(___e);
    }
  });
}

/**
 *
 * @param app
 */
/**
 * ServeStatic function.
 * @param app
 * @returns Function result.
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), 'dist', 'public');

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // Skip API routes - let them be handled by API middleware (same as development)
  app.use('*', (req, res, next) => {
    // Skip API routes - let them be handled by API middleware
    if (req.originalUrl.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}
