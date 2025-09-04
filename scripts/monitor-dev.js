#!/usr/bin/env node

/**
 * Development Monitor Script
 * Monitors the development server and restarts it if it crashes
 */

const { spawn } = require('child_process');
const path = require('path');

let serverProcess = null;
let restartCount = 0;
const maxRestarts = 10;

function startServer() {
  console.log('🚀 Starting development server...');
  
  serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  serverProcess.on('close', (code) => {
    console.log(`\n⚠️ Server process exited with code ${code}`);
    
    if (code !== 0 && restartCount < maxRestarts) {
      restartCount++;
      console.log(`🔄 Restarting server (attempt ${restartCount}/${maxRestarts})...`);
      setTimeout(() => {
        startServer();
      }, 2000);
    } else if (restartCount >= maxRestarts) {
      console.error('❌ Maximum restart attempts reached. Please check for issues.');
      process.exit(1);
    }
  });

  serverProcess.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down monitor...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Shutting down monitor...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

console.log('🔍 Development monitor starting...');
startServer();