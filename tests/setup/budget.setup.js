/**
 * @file Budget Test Setup
 * @description Setup configuration specifically for budget-related tests
 */

// Global test setup for budget tests
import { configure } from '@testing-library/react';
import '@testing-library/jest-dom';

// Configure testing library for budget tests
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000, // Increased timeout for API interactions
});

// Layout polyfills are installed as real classes/functions (not jest.fn()
// mocks) so they survive `jest.resetAllMocks()` / `jest.restoreAllMocks()`
// calls in test suites. Radix UI primitives (Switch, Select, Dialog, ...)
// call `new ResizeObserver(cb).observe(node)` during layout effects; if the
// polyfill were a `jest.fn()` whose implementation got wiped by a mock reset,
// every subsequent render would crash with
// "resizeObserver.observe is not a function".
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverPolyfill;

class IntersectionObserverPolyfill {
  constructor() {
    this.root = null;
    this.rootMargin = '';
    this.thresholds = [];
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
global.IntersectionObserver = IntersectionObserverPolyfill;

// matchMedia polyfill installed as a plain function (not a jest.fn()) so it
// survives `jest.resetAllMocks()` / `jest.restoreAllMocks()` calls.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock console methods for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress expected errors in tests
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Warning: ComponentsWithHierarchicalSelection') ||
        args[0].includes('act(...)'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
        args[0].includes('componentWillMount'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Budget-specific test utilities
global.budgetTestUtils = {
  // Helper to create mock forecast data
  createMockForecastData: (overrides = {}) => ({
    buildingId: 'test-building-id',
    buildingName: 'Test Building',
    forecastPeriod: '25 years',
    startingBalance: 100000,
    minimumFund: 10000,
    generalInflationRate: 2.5,
    revenueInflationRate: 3.0,
    baselineMonthlyIncome: 50000,
    baselineMonthlyExpenses: 30000,
    recurrentBillsCount: 5,
    uniqueBillsCount: 3,
    forecast: Array.from({ length: 300 }, (_, index) => ({
      year: 2025 + Math.floor(index / 12),
      month: (index % 12) + 1,
      revenue: 50000,
      spending: 30000,
      netCashFlow: 20000,
      balance: 100000 + (index * 20000),
      status: 'green',
      inflatedIncome: 50000,
      inflatedExpenses: 30000,
    })),
    ...overrides,
  }),

  // Helper to create mock building data
  createMockBuildingData: (overrides = {}) => ({
    id: 'test-building-id',
    name: 'Test Building',
    bankAccountStartAmount: '100000',
    bankAccountMinimums: '10000',
    generalInflationRate: '2.5',
    revenueInflationRate: '3.0',
    ...overrides,
  }),

  // Helper to create mock bills data
  createMockBillsData: (type = 'recurrent', overrides = {}) => {
    if (type === 'recurrent') {
      return {
        id: 'test-bill-id',
        category: 'utilities',
        costs: ['5000'],
        schedulePayment: 'monthly',
        startDate: new Date('2025-01-01'),
        endDate: null,
        ...overrides,
      };
    } else {
      return {
        startDate: new Date('2025-06-01'),
        totalAmount: '50000',
        category: 'renovation',
        ...overrides,
      };
    }
  },

  // Helper to create mock budget data
  createMockBudgetData: (overrides = {}) => ({
    incomeTypes: ['monthly_fees', 'parking_fees'],
    incomes: ['45000', '5000'],
    spendingTypes: ['maintenance', 'utilities'],
    spendings: ['20000', '8000'],
    ...overrides,
  }),
};

// Set up fake timers for tests that need to control time
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

console.log('Budget test setup completed');