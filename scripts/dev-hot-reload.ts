#!/usr/bin/env node
/**
 * Koveo Gestion - Hot Reload Development Server
 * Automatically rebuilds and restarts the application when code files change
 */
import { spawn, ChildProcess } from 'child_process';
import chokidar from 'chokidar';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

interface ProcessInfo {
  process: any;
  isRestarting: boolean;
  lastRestart: number;
}

class HotReloadServer {
  private serverProcess: ProcessInfo = {
    process: null,
    isRestarting: false,
    lastRestart: 0
  };
  
  private readonly RESTART_DEBOUNCE = 1000; // 1 second debounce
  private readonly watchPaths = [
    'server/**/*.{ts,js,json}',
    'client/src/**/*.{ts,tsx,js,jsx,json}',
    'shared/**/*.{ts,js,json}',
    'package.json',
    'vite.config.ts',
    'tailwind.config.ts'
  ];
  
  private readonly ignorePaths = [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/*.md',
    '**/docs/**',
    '**/tests/**',
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.spec.{ts,tsx,js,jsx}',
    '**/scripts/dev-hot-reload.ts' // Don't watch ourselves
  ];

  constructor() {
    this.setupGracefulShutdown();
  }

  async start() {
    console.log(chalk.blue('🔥 Starting Hot Reload Development Server...'));
    console.log(chalk.gray('   Watching for changes in code files (excluding documentation)'));
    
    // Start the initial server
    await this.startServer();
    
    // Setup file watcher
    this.setupFileWatcher();
    
    console.log(chalk.green('✅ Hot reload system ready!'));
    console.log(chalk.gray('   Make changes to your code and see them automatically applied'));
  }

  private async startServer(): Promise<void> {
    if (this.serverProcess.process) {
      await this.stopServer();
    }

    console.log(chalk.yellow('🚀 Starting development server...'));
    
    this.serverProcess.process = spawn('npx', ['tsx', 'server/index.ts'], {
      stdio: 'inherit',
      env: { 
        ...process.env, 
        NODE_ENV: 'development',
        HOT_RELOAD: 'true',
        FORCE_COLOR: '1'
      },
      cwd: process.cwd()
    });

    this.serverProcess.process.on('error', (error: Error) => {
      console.error(chalk.red('❌ Server process error:'), error.message);
    });

    this.serverProcess.process.on('exit', (code: number) => {
      if (!this.serverProcess.isRestarting && code !== 0) {
        console.error(chalk.red(`❌ Server exited with code ${code}`));
      }
    });

    // Give the server a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (this.serverProcess.process && !this.serverProcess.process.killed) {
      console.log(chalk.green('✅ Development server started successfully'));
    }
  }

  private async stopServer(): Promise<void> {
    if (!this.serverProcess.process) return;

    console.log(chalk.yellow('⏹️  Stopping server...'));
    this.serverProcess.isRestarting = true;

    return new Promise((resolve) => {
      if (!this.serverProcess.process) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        if (this.serverProcess.process && !this.serverProcess.process.killed) {
          console.log(chalk.red('🔪 Force killing server process...'));
          this.serverProcess.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.serverProcess.process.on('exit', () => {
        clearTimeout(timeout);
        this.serverProcess.process = null;
        this.serverProcess.isRestarting = false;
        resolve();
      });

      // Graceful shutdown
      this.serverProcess.process.kill('SIGTERM');
    });
  }

  private setupFileWatcher(): void {
    const watcher = chokidar.watch(this.watchPaths, {
      ignored: this.ignorePaths,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    watcher.on('ready', () => {
      console.log(chalk.blue('👁️  File watcher ready'));
      console.log(chalk.gray(`   Watching: ${this.watchPaths.join(', ')}`));
    });

    watcher.on('change', (filePath: string) => {
      this.handleFileChange(filePath, 'changed');
    });

    watcher.on('add', (filePath: string) => {
      this.handleFileChange(filePath, 'added');
    });

    watcher.on('unlink', (filePath: string) => {
      this.handleFileChange(filePath, 'removed');
    });

    watcher.on('error', (error: Error) => {
      console.error(chalk.red('❌ File watcher error:'), error.message);
    });
  }

  private handleFileChange(filePath: string, changeType: string): void {
    const now = Date.now();
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Debounce rapid changes
    if (now - this.serverProcess.lastRestart < this.RESTART_DEBOUNCE) {
      return;
    }

    console.log(chalk.cyan(`📝 File ${changeType}: ${relativePath}`));
    
    // Determine if this change requires a restart
    const needsRestart = this.needsServerRestart(filePath);
    
    if (needsRestart) {
      this.serverProcess.lastRestart = now;
      console.log(chalk.magenta('🔄 Restarting server due to code changes...'));
      this.restartServer();
    } else {
      console.log(chalk.gray('   Frontend changes will be handled by Vite HMR'));
    }
  }

  private needsServerRestart(filePath: string): boolean {
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Server-side files always need restart
    if (relativePath.startsWith('server/')) return true;
    if (relativePath.startsWith('shared/')) return true;
    if (relativePath === 'package.json') return true;
    if (relativePath === 'vite.config.ts') return true;
    if (relativePath === 'tailwind.config.ts') return true;
    
    // Client-side files are handled by Vite HMR
    if (relativePath.startsWith('client/')) return false;
    
    // Default to restart for safety
    return true;
  }

  private async restartServer(): Promise<void> {
    if (this.serverProcess.isRestarting) {
      console.log(chalk.yellow('⏳ Server restart already in progress...'));
      return;
    }

    try {
      await this.stopServer();
      await this.startServer();
      console.log(chalk.green('✅ Server restarted successfully'));
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to restart server:'), error.message);
      console.log(chalk.yellow('🔄 Attempting recovery...'));
      
      // Attempt recovery
      setTimeout(() => {
        this.startServer();
      }, 2000);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(chalk.yellow(`\n📡 Received ${signal}, shutting down gracefully...`));
      await this.stopServer();
      console.log(chalk.green('✅ Hot reload server stopped'));
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  }
}

// Start the hot reload server
const hotReloadServer = new HotReloadServer();
hotReloadServer.start().catch((error: Error) => {
  console.error(chalk.red('❌ Failed to start hot reload server:'), error.message);
  process.exit(1);
});