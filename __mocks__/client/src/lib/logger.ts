export function logDebug(_message: string, ..._args: unknown[]): void {}
export function logInfo(_message: string, ..._args: unknown[]): void {}
export function logWarn(message: string, ...args: unknown[]): void {
  console.warn(`[WARN] ${message}`, ...args);
}
export function logError(message: string, ...args: unknown[]): void {
  console.error(`[ERROR] ${message}`, ...args);
}
