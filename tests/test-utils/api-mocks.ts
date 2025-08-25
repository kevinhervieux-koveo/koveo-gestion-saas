/**
 * API mocking utilities for tests.
 */

import { jest } from '@jest/globals';

/**
 * Mock API request function that can be configured for different responses.
 */
export const mockApiRequest = jest.fn() as jest.MockedFunction<any>;

/**
 * Reset all API mocks.
 */
export const resetApiMocks = () => {
  mockApiRequest.mockReset();
  mockApiRequest.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true }),
    status: 200,
  });
};

/**
 * Mock successful API response.
 * @param data
 */
export const mockApiSuccess = (data: any = { success: true }) => {
  mockApiRequest.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
    status: 200,
  });
};

/**
 * Mock API error response.
 * @param message
 * @param status
 */
export const mockApiError = (message: string = 'API Error', status: number = 500) => {
  mockApiRequest.mockRejectedValueOnce(new Error(message));
};

/**
 * Mock API validation error.
 * @param errors
 */
export const mockValidationError = (errors: Record<string, string>) => {
  mockApiRequest.mockResolvedValueOnce({
    ok: false,
    json: () => Promise.resolve({ errors }),
    status: 400,
  });
};
