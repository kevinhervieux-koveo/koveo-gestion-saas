/**
 * DOM type definitions for browser APIs used in the application.
 */
declare global {
  interface Window {
    // Any additional window properties can be added here
  }
}

// Browser API types that may not be available in Node.js environment
declare var File: {
  prototype: File;
  new(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag): File;
};

declare var FormData: {
  prototype: FormData;
  new(form?: HTMLFormElement): FormData;
};

export {};