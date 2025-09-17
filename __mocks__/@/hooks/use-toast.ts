/**
 * Mock for @/hooks/use-toast - Provides controlled toast notifications for tests
 */

// Mock toast function that can be spied on
export const mockToast = jest.fn();

// Mock useToast hook
export const useToast = jest.fn(() => ({
  toast: mockToast,
}));

// Test utilities to control toast behavior
export const __mockToastUtils = {
  // Get the mock function for assertions
  getMockToast: () => mockToast,
  
  // Reset the mock
  reset: () => {
    mockToast.mockClear();
  },
  
  // Check if toast was called with specific parameters
  wasCalledWith: (expectedCall: { title?: string; description?: string; variant?: string }) => {
    return mockToast.mock.calls.some(call => {
      const callArgs = call[0];
      return (
        (!expectedCall.title || callArgs.title === expectedCall.title) &&
        (!expectedCall.description || callArgs.description === expectedCall.description) &&
        (!expectedCall.variant || callArgs.variant === expectedCall.variant)
      );
    });
  },
};