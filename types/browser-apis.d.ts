/**
 * Browser API type definitions for File and FormData
 * These are needed when using browser APIs in components
 */

declare global {
  var File: {
    new(_fileBits: BlobPart[], _fileName: string, _options?: FilePropertyBag): File;
    prototype: File;
  };
  
  var FormData: {
    new(_form?: HTMLFormElement | undefined, _submitter?: HTMLElement | null | undefined): FormData;
    prototype: FormData;
  };
}

export {};