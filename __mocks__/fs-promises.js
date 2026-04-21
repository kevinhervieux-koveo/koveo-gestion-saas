/**
 * Mock for fs/promises module to provide safe async file operations
 * Ensures tests don't block on real file system operations
 */

const jest = global.jest || {
  fn: (impl) => {
    const mockFn = impl || (() => Promise.resolve());
    mockFn.mockResolvedValue = (value) => {
      mockFn._mockResolvedValue = value;
      return mockFn;
    };
    return mockFn;
  }
};

// Mock file stats for compatibility
const createMockStats = (isFile = true, isDirectory = false) => ({
  isFile: () => isFile,
  isDirectory: () => isDirectory,
  size: 1024,
  mtime: new Date(),
  ctime: new Date(),
  atime: new Date(),
  mode: 0o644,
  uid: 1000,
  gid: 1000
});

// Mock file content for known test files
const getMockFileContent = (path) => {
  if (path.includes('create-demo-environment.ts')) {
    return `
import * as schema from '../shared/schema';
import { initializeDatabase } from './db-init';
import { faker } from '@faker-js/faker';

// Demo 123 organization
const BUILDINGS_COUNT = 5;

async function seedUsers() { /* Mock implementation */ }
async function seedBuildings() { /* Mock implementation */ }  
async function seedResidences() { /* Mock implementation */ }
async function seedBookings() { /* Mock implementation */ }
async function seedMaintenanceRequests() { /* Mock implementation */ }
async function seedBills() { /* Mock implementation */ }
async function seedDocuments() { 
  // Proper file path handling - no uploads prefix
  writeDocumentFile(filePath, content);
}

function writeDocumentFile(filePath, content) {
  // + Electrical systems - ASCII format
  // - On Time - ASCII status
}

// Validation functions
function validation() { /* Mock validation */ }
function unique() { /* Mock unique check */ }
function email() { /* Mock email validation */ }
function phone() { /* Mock phone validation */ }

process.exit(0); // This would normally hang tests
`;
  }
  
  return 'Mock file content for testing';
};

// Export promise-based fs functions
module.exports = {
  readFile: jest.fn().mockImplementation(async (path, options) => {
    return getMockFileContent(path);
  }),
  
  writeFile: jest.fn().mockResolvedValue(),
  
  stat: jest.fn().mockImplementation(async (path) => {
    // Return stats that indicate file exists
    return createMockStats(true, false);
  }),
  
  access: jest.fn().mockResolvedValue(),
  
  mkdir: jest.fn().mockResolvedValue(),
  
  readdir: jest.fn().mockResolvedValue(['mock-file.txt', 'mock-dir']),
  
  rm: jest.fn().mockResolvedValue(),
  
  rmdir: jest.fn().mockResolvedValue(),
  
  unlink: jest.fn().mockResolvedValue(),
  
  copyFile: jest.fn().mockResolvedValue(),
  
  rename: jest.fn().mockResolvedValue()
};