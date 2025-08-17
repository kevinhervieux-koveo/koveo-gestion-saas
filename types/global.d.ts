/**
 * Global type definitions for the application
 */
declare global {
  namespace NodeJS {
    interface Global {
      fetch: any;
    }
  }
  
  interface Window {
    fetch: any;
  }
}

/**
 * Asset module declarations
 */
declare module '@assets/*' {
  const value: string;
  export default value;
}

/**
 * Wouter router type extensions
 */
declare module 'wouter' {
  export { Router as BrowserRouter } from 'wouter';
}

/**
 * Wouter memory location hook types
 */
declare module 'wouter/memory' {
  interface StubHistory {
    history: string[];
    reset: () => void;
    value: string;
  }
  
  type HookReturnValue = [string, (path: string) => void];
  
  function memoryLocation(_options: { path: string }): HookReturnValue & StubHistory;
  export { memoryLocation };
}

export {};