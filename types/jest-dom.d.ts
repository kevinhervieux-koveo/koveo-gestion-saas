// Jest DOM type declarations for testing
import '@testing-library/jest-dom';

declare global {
  namespace jest {
    /**
     * Jest DOM matchers interface for testing library integration.
     */
    interface Matchers<R = void> {
      toBeInTheDocument(): R;
      toHaveTextContent(_text: string | RegExp): R;
      toBeVisible(): R;
      toBeEnabled(): R;
      toBeDisabled(): R;
      toHaveAttribute(_attr: string, _value?: string): R;
      toHaveClass(_className: string): R;
      toHaveStyle(_css: string | Record<string, unknown>): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toHaveValue(_value: string | string[] | number): R;
      toHaveDisplayValue(_value: string | RegExp | (string | RegExp)[]): R;
      toBeRequired(): R;
      toBeInvalid(): R;
      toBeValid(): R;
      toHaveFocus(): R;
      toHaveFormValues(_expectedValues: Record<string, unknown>): R;
      toHaveErrorMessage(_text: string | RegExp): R;
      toHaveDescription(_text: string | RegExp): R;
    }
  }
}
