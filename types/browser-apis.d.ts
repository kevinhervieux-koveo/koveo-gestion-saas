/**
 * Browser API type definitions for File and FormData.
 * These are needed when using browser APIs in components.
 */

declare global {
  /**
   * File constructor interface for creating File objects.
   */
  var File: {
    new(_fileBits: (string | Blob | ArrayBuffer | ArrayBufferView)[], _fileName: string, _options?: {
      type?: string;
      lastModified?: number;
    }): File;
    prototype: File;
  };
  
  /**
   * FormData constructor interface for creating FormData objects.
   */
  var FormData: {
    new(_form?: HTMLFormElement | undefined, _submitter?: HTMLElement | null | undefined): FormData;
    prototype: FormData;
  };
}

export {};