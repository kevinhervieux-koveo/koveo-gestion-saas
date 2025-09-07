/**
 * Mock for file system operations to prevent hanging during tests
 */

const mockStats = {
  isFile: jest.fn().mockReturnValue(true),
  isDirectory: jest.fn().mockReturnValue(false),
  size: 1024,
  mtime: new Date(),
  ctime: new Date(),
  atime: new Date()
};

const mockFs = {
  // File operations
  readFileSync: jest.fn().mockReturnValue('mock file content'),
  writeFileSync: jest.fn(),
  readFile: jest.fn().mockImplementation((path, callback) => {
    if (typeof callback === 'function') {
      callback(null, 'mock file content');
    }
  }),
  writeFile: jest.fn().mockImplementation((path, data, callback) => {
    if (typeof callback === 'function') {
      callback(null);
    }
  }),
  
  // Directory operations
  mkdirSync: jest.fn(),
  mkdir: jest.fn().mockImplementation((path, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }
    if (typeof callback === 'function') {
      callback(null);
    }
  }),
  readdirSync: jest.fn().mockReturnValue(['file1.txt', 'file2.txt']),
  readdir: jest.fn().mockImplementation((path, callback) => {
    callback(null, ['file1.txt', 'file2.txt']);
  }),
  
  // File existence and stats
  existsSync: jest.fn().mockReturnValue(true),
  exists: jest.fn().mockImplementation((path, callback) => {
    callback(true);
  }),
  statSync: jest.fn().mockReturnValue(mockStats),
  stat: jest.fn().mockImplementation((path, callback) => {
    callback(null, mockStats);
  }),
  lstatSync: jest.fn().mockReturnValue(mockStats),
  lstat: jest.fn().mockImplementation((path, callback) => {
    callback(null, mockStats);
  }),
  
  // File removal
  unlinkSync: jest.fn(),
  unlink: jest.fn().mockImplementation((path, callback) => {
    if (typeof callback === 'function') {
      callback(null);
    }
  }),
  rmSync: jest.fn(),
  rmdirSync: jest.fn(),
  rmdir: jest.fn().mockImplementation((path, callback) => {
    callback(null);
  }),
  
  // File access
  accessSync: jest.fn(),
  access: jest.fn().mockImplementation((path, mode, callback) => {
    if (typeof mode === 'function') {
      callback = mode;
    }
    callback(null);
  }),
  
  // Copy operations
  copyFileSync: jest.fn(),
  copyFile: jest.fn().mockImplementation((src, dest, callback) => {
    callback(null);
  }),
  
  // Constants
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
  },
  
  // Streams
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    read: jest.fn(),
    destroy: jest.fn()
  }),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    destroy: jest.fn()
  })
};

// Import real path to avoid breaking Jest internals
const realPath = require.cache[require.resolve('path')] ? require.cache[require.resolve('path')].exports : require('path');

// Create a more robust path mock that preserves core functionality
const mockPath = {
  // Use real implementations for core functions to avoid breaking Jest
  join: realPath.join,
  resolve: realPath.resolve,
  dirname: realPath.dirname,
  basename: realPath.basename,
  extname: realPath.extname,
  parse: realPath.parse,
  sep: realPath.sep,
  delimiter: realPath.delimiter,
  posix: realPath.posix,
  win32: realPath.win32,
  
  // Add any additional mock functionality if needed
  _isMocked: true
};

// Mock multer for file uploads
const mockMulter = jest.fn().mockImplementation((options = {}) => {
  const storage = options.storage || {};
  
  return {
    single: jest.fn().mockImplementation((fieldName) => (req, res, next) => {
      req.file = {
        fieldname: fieldName,
        originalname: 'test-file.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        buffer: Buffer.from('test content'),
        size: 12,
        filename: 'test-file.txt',
        path: '/mock/uploads/test-file.txt'
      };
      next();
    }),
    
    array: jest.fn().mockImplementation((fieldName, maxCount) => (req, res, next) => {
      req.files = [
        {
          fieldname: fieldName,
          originalname: 'test-file-1.txt',
          encoding: '7bit',
          mimetype: 'text/plain',
          buffer: Buffer.from('test content 1'),
          size: 14,
          filename: 'test-file-1.txt',
          path: '/mock/uploads/test-file-1.txt'
        }
      ];
      next();
    }),
    
    fields: jest.fn().mockImplementation((fields) => (req, res, next) => {
      req.files = {};
      fields.forEach(field => {
        req.files[field.name] = [{
          fieldname: field.name,
          originalname: `test-${field.name}.txt`,
          encoding: '7bit',
          mimetype: 'text/plain',
          buffer: Buffer.from(`test content for ${field.name}`),
          size: 20,
          filename: `test-${field.name}.txt`,
          path: `/mock/uploads/test-${field.name}.txt`
        }];
      });
      next();
    }),
    
    any: jest.fn().mockImplementation(() => (req, res, next) => {
      req.files = [
        {
          fieldname: 'files',
          originalname: 'test-any.txt',
          encoding: '7bit',
          mimetype: 'text/plain',
          buffer: Buffer.from('test any content'),
          size: 16,
          filename: 'test-any.txt',
          path: '/mock/uploads/test-any.txt'
        }
      ];
      next();
    })
  };
});

// Mock multer storage engines
mockMulter.diskStorage = jest.fn().mockImplementation((options = {}) => ({
  _handleFile: jest.fn(),
  _removeFile: jest.fn()
}));

mockMulter.memoryStorage = jest.fn().mockImplementation(() => ({
  _handleFile: jest.fn(),
  _removeFile: jest.fn()
}));

module.exports = {
  fs: mockFs,
  path: mockPath,
  multer: mockMulter,
  default: mockFs
};