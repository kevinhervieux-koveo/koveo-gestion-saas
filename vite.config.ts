import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// Removes calls to `logDebug(...)` and `logInfo(...)` from client source
// in production builds. The wrapper functions in `client/src/lib/logger.ts`
// already collapse to no-ops in production, but their string/object
// arguments still ship in the bundle. Esbuild's `pure` annotation only
// drops direct globals like `console.log`, not these imported wrappers,
// so we strip the calls at the source level. Call expressions are
// replaced with `void 0` so they remain valid JS in any position
// (statement, ternary, &&-chain, etc.).
function stripDebugLogs(): Plugin {
  const callRe = /(?<![\w$.])(logDebug|logInfo)\s*\(/g;
  const loggerSuffix = path.join('lib', 'logger.ts');
  return {
    name: 'strip-debug-logs',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.(tsx?|jsx?)$/.test(id)) return null;
      if (id.includes('node_modules')) return null;
      if (id.endsWith(loggerSuffix)) return null;
      callRe.lastIndex = 0;
      if (!callRe.test(code)) return null;
      callRe.lastIndex = 0;

      let out = '';
      let lastIdx = 0;
      let m: RegExpExecArray | null;
      while ((m = callRe.exec(code)) !== null) {
        const start = m.index;
        let i = m.index + m[0].length; // position right after the opening '('
        let depth = 1;
        let strDelim: string | null = null; // ' " or `
        const tplBraceStack: number[] = []; // nesting of `${...}` inside template literals

        while (i < code.length && depth > 0) {
          const ch = code[i];
          const next = code[i + 1];
          if (strDelim) {
            if (ch === '\\') {
              i += 2;
              continue;
            }
            if (strDelim === '`') {
              if (ch === '$' && next === '{') {
                tplBraceStack.push(1);
                strDelim = null;
                i += 2;
                continue;
              }
              if (ch === '`') {
                strDelim = null;
                i++;
                continue;
              }
            } else if (ch === strDelim) {
              strDelim = null;
              i++;
              continue;
            }
            i++;
            continue;
          }
          if (ch === '/' && next === '/') {
            while (i < code.length && code[i] !== '\n') i++;
            continue;
          }
          if (ch === '/' && next === '*') {
            i += 2;
            while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
            i += 2;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === '`') {
            strDelim = ch;
            i++;
            continue;
          }
          if (tplBraceStack.length > 0) {
            if (ch === '{') {
              tplBraceStack[tplBraceStack.length - 1]++;
            } else if (ch === '}') {
              tplBraceStack[tplBraceStack.length - 1]--;
              if (tplBraceStack[tplBraceStack.length - 1] === 0) {
                tplBraceStack.pop();
                strDelim = '`';
                i++;
                continue;
              }
            }
          }
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
          i++;
        }
        if (depth !== 0) {
          // Couldn't balance parens (parse error or unsupported syntax).
          // Bail out for safety: leave this call untouched.
          continue;
        }
        out += code.slice(lastIdx, start) + 'void 0';
        lastIdx = i;
        callRe.lastIndex = i;
      }
      if (lastIdx === 0) return null;
      out += code.slice(lastIdx);
      return { code: out, map: null };
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(command === 'build' && mode === 'production' ? [stripDebugLogs()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  esbuild:
    command === 'build' && mode === 'production'
      ? {
          // Strip diagnostic console calls (log/debug/info/trace) and any
          // `debugger` statements from the production client bundle so the
          // browser console only shows real warnings/errors. `console.warn`
          // and `console.error` are intentionally preserved.
          pure: ['console.log', 'console.debug', 'console.info', 'console.trace'],
          drop: ['debugger'],
        }
      : undefined,
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || (id.includes('/react/') && !id.includes('react-'))) return 'vendor-react';
            if (id.includes('@radix-ui')) return 'vendor-ui';
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/')) return 'vendor-forms';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts';
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) return 'vendor-utils';
            if (id.includes('date-fns')) return 'vendor-date-fns';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('cmdk')) return 'vendor-cmdk';
            if (id.includes('dompurify') || id.includes('isomorphic-dompurify') || id.includes('purify')) return 'vendor-sanitize';
            if (id.includes('marked')) return 'vendor-markdown';
            if (id.includes('wouter')) return 'vendor-router';
            if (id.includes('embla-carousel')) return 'vendor-carousel';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('input-otp')) return 'vendor-otp';
            if (id.includes('react-day-picker')) return 'vendor-datepicker';
            if (id.includes('react-resizable-panels')) return 'vendor-panels';
            if (id.includes('vaul')) return 'vendor-drawer';
            if (id.includes('sonner')) return 'vendor-sonner';
          }
        },
      },
    },
    // Default Vite warning limit. Kept explicit so chunk-size regressions
    // are surfaced loudly during build.
    chunkSizeWarningLimit: 500,
  },
  server: {
    host: '0.0.0.0',
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
}));
