declare global {
  namespace NodeJS {
    interface Global {
      fetch: any;
    }
  }
}

declare module '@assets/*' {
  const value: string;
  export default value;
}

declare module 'wouter' {
  export { Router as BrowserRouter } from 'wouter';
}

declare module 'wouter/memory' {
  export interface StubHistory {
    history: string[];
    reset: () => void;
    value: string;
  }
  
  export type HookReturnValue = [string, (path: string) => void];
  
  export function memoryLocation(options: { path: string }): HookReturnValue & StubHistory;
}

export {};