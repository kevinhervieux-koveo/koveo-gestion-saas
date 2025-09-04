#!/usr/bin/env node
/**
 * Aggressive development watcher for Koveo Gestion
 * Provides faster hot reload by monitoring file changes and restarting services
 */

import { spawn } from 'child_process';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let serverProcess = null;
let isRestarting = false;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function startServer() {
  log(colors.blue, '🚀 Starting development server...');
  
  serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit'
  });

  serverProcess.on('exit', (code) => {
    if (!isRestarting) {
      log(colors.red, `❌ Server exited with code ${code}`);
      process.exit(code);
    }
  });
}

function restartServer() {
  if (isRestarting) return;
  
  isRestarting = true;
  log(colors.yellow, '🔄 Restarting server...');
  
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }, 2000);
  }
  
  setTimeout(() => {
    isRestarting = false;
    startServer();
  }, 500);
}

// Enhanced file watching with debouncing
let restartTimer = null;
function scheduleRestart(path) {
  log(colors.cyan, `📁 File changed: ${path}`);
  
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  
  restartTimer = setTimeout(() => {
    restartServer();
    restartTimer = null;
  }, 300); // 300ms debounce
}

log(colors.green, '👀 Setting up aggressive file watcher...');

// Watch server files aggressively
const serverWatcher = chokidar.watch([
  'server/**/*.ts',
  'server/**/*.js',
  'shared/**/*.ts',
  '*.ts',
  '*.js'
], {
  cwd: rootDir,
  ignored: [
    'node_modules/**',
    'dist/**',
    'uploads/**',
    '**/*.test.*',
    '**/*.spec.*',
    '.git/**'
  ],
  ignoreInitial: true,
  usePolling: true,
  interval: 200
});

// Watch client files for Vite HMR compatibility
const clientWatcher = chokidar.watch([
  'client/**/*.ts',
  'client/**/*.tsx',
  'client/**/*.js',
  'client/**/*.jsx',
  'client/**/*.css'
], {
  cwd: rootDir,
  ignored: ['node_modules/**', 'dist/**'],
  ignoreInitial: true,
  usePolling: true,
  interval: 100
});

serverWatcher.on('change', scheduleRestart);
serverWatcher.on('add', scheduleRestart);
serverWatcher.on('unlink', scheduleRestart);

clientWatcher.on('change', (path) => {
  log(colors.magenta, `🎨 Client file changed: ${path} (Vite HMR should handle this)`);
});

log(colors.green, '✅ Aggressive file watching enabled!');
log(colors.dim, '   • Server files: 200ms polling');
log(colors.dim, '   • Client files: 100ms polling');
log(colors.dim, '   • Restart debounce: 300ms');

// Start the initial server
startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  log(colors.yellow, '\n🛑 Shutting down development server...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});