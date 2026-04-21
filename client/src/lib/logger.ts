const isDevelopment = import.meta.env.DEV;

export function logDebug(message: string, ...args: unknown[]): void {
  if (isDevelopment) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

export function logInfo(message: string, ...args: unknown[]): void {
  if (isDevelopment) {
    console.info(`[INFO] ${message}`, ...args);
  }
}

export function logWarn(message: string, ...args: unknown[]): void {
  console.warn(`[WARN] ${message}`, ...args);
}

export function logError(message: string, ...args: unknown[]): void {
  console.error(`[ERROR] ${message}`, ...args);
}
