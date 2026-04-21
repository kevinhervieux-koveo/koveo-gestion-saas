/**
 * Mock for child_process module to prevent hanging in tests
 * Provides safe, fast-returning mocks for all child process operations
 */

// Mock exec function that returns immediately
const mockExec = (command, options, callback) => {
  const result = {
    stdout: `Mock output for: ${command}`,
    stderr: ''
  };
  
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  if (callback) {
    setImmediate(() => callback(null, result.stdout, result.stderr));
  }
  
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    pid: 12345,
    kill: () => {},
    on: () => {},
    removeListener: () => {}
  };
};

// Mock spawn function
const mockSpawn = (command, args, options) => {
  return {
    stdout: {
      on: () => {},
      pipe: () => {}
    },
    stderr: {
      on: () => {},
      pipe: () => {}
    },
    on: (event, callback) => {
      if (event === 'close') {
        setImmediate(() => callback(0));
      }
    },
    kill: () => {},
    pid: 12345
  };
};

// Mock execSync function
const mockExecSync = (command, options) => {
  return `Mock sync output for: ${command}`;
};

// Mock fork function
const mockFork = (modulePath, args, options) => {
  return {
    send: () => {},
    on: () => {},
    kill: () => {},
    pid: 12345
  };
};

module.exports = {
  exec: mockExec,
  spawn: mockSpawn,
  execSync: mockExecSync,
  fork: mockFork,
  execFile: mockExec,
  spawnSync: (command, args) => ({
    status: 0,
    stdout: Buffer.from(`Mock sync spawn output for: ${command}`),
    stderr: Buffer.from(''),
    pid: 12345
  })
};