/**
 * Browser API type definitions for File and FormData.
 * These are needed when using browser APIs in components.
 */

/**
 * Browser API interfaces for File, FormData, and Blob.
 */
interface FilePropertyBag {
  type?: string;
  lastModified?: number;
}

/**
 *
 */
interface BlobPropertyBag {
  type?: string;
}

declare global {
  /**
   *
   */
  interface File extends Blob {
    readonly lastModified: number;
    readonly name: string;
  }

  /**
   *
   */
  interface FormData {
    append(name: string, value: string | Blob, fileName?: string): void;
    delete(name: string): void;
    get(name: string): FormDataEntryValue | null;
    getAll(name: string): FormDataEntryValue[];
    has(name: string): boolean;
    set(name: string, value: string | Blob, fileName?: string): void;
  }

  /**
   *
   */
  interface Blob {
    readonly size: number;
    readonly type: string;
    slice(start?: number, end?: number, contentType?: string): Blob;
  }

  var File: {
    new(_fileBits: BlobPart[], _fileName: string, _options?: FilePropertyBag): File;
    prototype: File;
  };
  
  var FormData: {
    new(_form?: HTMLFormElement): FormData;
    prototype: FormData;
  };

  var Blob: {
    new(_blobParts?: BlobPart[], _options?: BlobPropertyBag): Blob;
    prototype: Blob;
  };

  /**
   *
   */
  type BlobPart = string | Blob | ArrayBuffer | ArrayBufferView;
  /**
   *
   */
  type FormDataEntryValue = File | string;
}

export {};