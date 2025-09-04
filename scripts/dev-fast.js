#!/usr/bin/env node
/**
 * Ultra-fast development mode for Koveo Gestion
 * Bypasses normal startup checks for immediate feedback
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

log(colors.blue, '⚡ Starting ULTRA-FAST development mode...');

// Start with tsx watch for immediate TypeScript compilation and restart
const serverProcess = spawn('npx', ['tsx', 'watch', '--clear-screen=false', 'server/index.ts'], {
  cwd: rootDir,
  env: { 
    ...process.env, 
    NODE_ENV: 'development',
    TSX_TSCONFIG_PATH: join(rootDir, 'tsconfig.json')
  },
  stdio: 'inherit'
});

log(colors.green, '✅ Ultra-fast mode active:');
log(colors.yellow, '   • TSX watch mode enabled');
log(colors.yellow, '   • Instant TypeScript compilation');
log(colors.yellow, '   • Automatic server restart on changes');
log(colors.yellow, '   • No build delays');

serverProcess.on('exit', (code) => {
  log(colors.reset, `Development server exited with code ${code}`);
  process.exit(code);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log(colors.yellow, '\n🛑 Shutting down ultra-fast development...');
  serverProcess.kill('SIGTERM');
  process.exit(0);
});