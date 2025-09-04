/// <reference types="@testing-library/jest-dom" />

// Extend Jest matchers to include jest-dom custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveValue(value: string | number | string[]): R;
      toBeVisible(): R;
      toBeEnabled(): R;
      toBeDisabled(): R;
      toHaveClass(className: string): R;
      toHaveAttribute(attr: string, value?: string): R;
    }
  }
}