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
 * Properties for creating a new Blob.
 */
interface BlobPropertyBag {
  type?: string;
}

declare global {
  /**
   * File interface representing file data.
   */
  interface File extends Blob {
    readonly lastModified: number;
    readonly name: string;
  }

  /**
   * FormData interface for handling form data.
   */
  interface FormData {
    append(_name: string, _value: string | Blob, _fileName?: string): void;
    delete(_name: string): void;
    get(_name: string): FormDataEntryValue | null;
    getAll(_name: string): FormDataEntryValue[];
    has(_name: string): boolean;
    set(_name: string, _value: string | Blob, _fileName?: string): void;
  }

  /**
   * Blob interface representing immutable raw data.
   */
  interface Blob {
    readonly size: number;
    readonly type: string;
    slice(_start?: number, _end?: number, _contentType?: string): Blob;
  }

  var File: {
    new (_fileBits: BlobPart[], _fileName: string, _options?: FilePropertyBag): File;
    prototype: File;
  };

  var FormData: {
    new (_form?: HTMLFormElement): FormData;
    prototype: FormData;
  };

  var Blob: {
    new (_blobParts?: BlobPart[], _options?: BlobPropertyBag): Blob;
    prototype: Blob;
  };

  /**
   * Blob part type for creating blobs.
   */
  type BlobPart = string | Blob | ArrayBuffer | ArrayBufferView;
  /**
   * Form data entry value type.
   */
  type FormDataEntryValue = File | string;

  /**
   * Performance interface for performance monitoring.
   */
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    now(): number;
  }

  /**
   * NodeJS interface for Node.js specific types.
   */
  interface NodeJS {
    Timeout: ReturnType<typeof setTimeout>;
  }

  /**
   * Storage interface for browser storage.
   */
  interface Storage {
    readonly length: number;
    clear(): void;
    getItem(_key: string): string | null;
    key(_index: number): string | null;
    removeItem(_key: string): void;
    setItem(_key: string, _value: string): void;
  }

  var performance: Performance;
  var sessionStorage: Storage;
  var localStorage: Storage;
}

export {};
