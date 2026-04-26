export const debugLog: (...args: unknown[]) => void = import.meta.env.DEV
  ? (...args: unknown[]) => console.debug('[bulk-import]', ...args)
  : () => {};
