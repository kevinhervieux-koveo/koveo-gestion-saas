// Simple Jest configuration for the project
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.{js,ts,tsx}'],
  passWithNoTests: true,
  verbose: true
};