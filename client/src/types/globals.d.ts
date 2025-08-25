/**
 * Global type definitions for client-side code.
 */

// DOM globals that might not be available in all test environments
declare global {
  /**
   *
   */
  interface Window {
    File: typeof File;
    FormData: typeof FormData;
  }
}

// Browser API types
/**
 *
 */
type FileConstructor = typeof File;
/**
 *
 */
type FormDataConstructor = typeof FormData;

export {};
