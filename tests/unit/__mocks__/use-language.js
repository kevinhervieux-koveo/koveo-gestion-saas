/* global jest */
// Global mock for useLanguage hook
export const useLanguage = jest.fn(() => ({
  language: 'en',
  setLanguage: jest.fn(),
  t: jest.fn((key) => key),
}));