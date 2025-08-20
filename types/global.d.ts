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
  const value: string;
  export default value;
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
    value: string;
  }
  
  /**
   * Hook return value type for wouter memory location.
   */
  type HookReturnValue = [string, (path: string) => void];
  
  /**
   * Memory location hook for testing.
   * @param _options - Configuration options.
   * @param _options._path - Initial path value for memory location.
   * @returns Combined hook return value and stub history.
   */
  function memoryLocation(options: { path: string }): HookReturnValue & StubHistory;
  export { memoryLocation };
}

export {};