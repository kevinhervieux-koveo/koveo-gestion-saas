/**
 * Global type definitions for the application.
 */
declare global {
  namespace NodeJS {
    /**
     *
     */
    interface Global {
      fetch: unknown;
    }
  }

  /**
   * Global window interface extensions.
   */
  interface Window {
    fetch: unknown;
  }
}

/**
 * Asset module declarations.
 */
declare module '@assets/*' {
  const _value: string;
  export default _value;
}

/**
 * Image file type declarations.
 */
declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

/**
 * Wouter router type extensions.
 */
declare module 'wouter' {
  /**
   *
   */
  interface Router {
    // Additional properties if needed
  }
}

/**
 * Wouter memory location hook types for testing.
 */
declare module 'wouter/memory' {
  /**
   * Stub history interface for testing wouter memory location.
   */
  interface StubHistory {
    history: string[];
    reset: () => void;
    _value: string;
  }

  /**
   * Hook return value type for wouter memory location.
   */
  type HookReturnValue = [string, (_path: string) => void];

  /**
   * Memory location hook for testing.
   * @param _options - Configuration options for memory location.
   * @param _options.path - Initial path value for memory location.
   * @returns Combined hook return value and stub history.
   */
  function memoryLocation(_options: { path: string }): HookReturnValue & StubHistory;
  export { memoryLocation };
}

/**
 * Jest DOM matcher declarations.
 */
import '@testing-library/jest-dom';

/**
 * Extend Jest matchers interface with DOM testing library matchers.
 */
declare global {
  namespace jest {
    /**
     * Jest DOM matchers interface extending the default Jest matchers.
     */
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toBeEmptyDOMElement(): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveAttribute(_attr: string, _value?: string | RegExp): R;
      toHaveClass(_className: string): R;
      toHaveFocus(): R;
      toHaveFormValues(_expectedValues: Record<string, unknown>): R;
      toHaveStyle(_css: string | Record<string, unknown>): R;
      toHaveTextContent(_text: string | RegExp): R;
      toHaveValue(_value: string | string[] | number): R;
      toHaveDisplayValue(_value: string | RegExp | (string | RegExp)[]): R;
      toBeChecked(): R;
      toHaveDescription(_text?: string | RegExp): R;
      toHaveErrorMessage(_text?: string | RegExp): R;
    }
  }
}

export {};
