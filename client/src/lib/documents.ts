/**
 * Document utility functions and constants.
 * Consolidates document-related functionality across the application.
 */

import { apiRequest } from '@/lib/queryClient';
import type { UploadResult } from '@uppy/core';

/**
 * Document categories for building documents.
 */
export const BUILDING_DOCUMENT_CATEGORIES = [
  { _value: 'bylaw', label: 'Bylaws' },
  { _value: 'financial', label: 'Financial' },
  { _value: 'maintenance', label: 'Maintenance' },
  { _value: 'legal', label: 'Legal' },
  { _value: 'meeting_minutes', label: 'Meeting Minutes' },
  { _value: 'insurance', label: 'Insurance' },
  { _value: 'contracts', label: 'Contracts' },
  { _value: 'permits', label: 'Permits' },
  { _value: 'inspection', label: 'Inspection' },
  { _value: 'other', label: 'Other' },
] as const;

/**
 * Document categories for residence documents.
 */
export const RESIDENCE_DOCUMENT_CATEGORIES = [
  { _value: 'lease', label: 'Lease Documents' },
  { _value: 'inspection', label: 'Inspections' },
  { _value: 'maintenance', label: 'Maintenance' },
  { _value: 'financial', label: 'Financial' },
  { _value: 'insurance', label: 'Insurance' },
  { _value: 'legal', label: 'Legal' },
  { _value: 'correspondence', label: 'Correspondence' },
  { _value: 'permits', label: 'Permits' },
  { _value: 'utilities', label: 'Utilities' },
  { _value: 'other', label: 'Other' },
] as const;

/**
 * General document categories for resident use.
 */
export const GENERAL_DOCUMENT_CATEGORIES = [
  { _value: 'lease', label: 'Lease Agreement' },
  { _value: 'insurance', label: 'Insurance' },
  { _value: 'inspection', label: 'Inspections' },
  { _value: 'maintenance', label: 'Maintenance' },
  { _value: 'financial', label: 'Financial' },
  { _value: 'legal', label: 'Legal Documents' },
  { _value: 'correspondence', label: 'Correspondence' },
  { _value: 'utilities', label: 'Utilities' },
  { _value: 'other', label: 'Other' },
] as const;

/**
 * Utility function to convert raw object storage URLs to server routes.
 * @param fileUrl - The file URL to convert.
 * @returns The displayable file URL.
 */
/**
 * Get displayable file url.
 * @param fileUrl - FileUrl parameter.
 * @returns String result.
 */
export function /**
 * Get displayable file url.
 * @param fileUrl - FileUrl parameter.
 * @returns String result.
 */ /**
 * Get displayable file url.
 * @param fileUrl - FileUrl parameter.
 * @returns String result.
 */

getDisplayableFileUrl(fileUrl: string): string {
  /**
   * If function.
   * @param !fileUrl - !fileUrl parameter.
   */ /**
   * If function.
   * @param !fileUrl - !fileUrl parameter.
   */

  if (!fileUrl) {
    return '';
  }

  // If it's already a proper server route, return as-is
  if (fileUrl.startsWith('/objects/') || fileUrl.startsWith('/public-objects/')) {
    return fileUrl;
  }

  // If it's a Google Cloud Storage URL, convert to objects route
  if (fileUrl.includes('storage.googleapis.com') || fileUrl.includes('googleapis.com')) {
    // Extract the path part after the bucket name
    const urlParts = fileUrl.split('/');
    const bucketIndex = urlParts.findIndex((part) => part.includes('googleapis.com')); /**
     * If function.
     * @param bucketIndex >= 0 && bucketIndex + 2 < urlParts.length - bucketIndex >= 0 && bucketIndex + 2 < urlParts.length parameter.
     */ /**
     * If function.
     * @param bucketIndex >= 0 && bucketIndex + 2 < urlParts.length - bucketIndex >= 0 && bucketIndex + 2 < urlParts.length parameter.
     */

    if (bucketIndex >= 0 && bucketIndex + 2 < urlParts.length) {
      const pathAfterBucket = urlParts.slice(bucketIndex + 2).join('/');
      return `/objects/${pathAfterBucket}`;
    }
  }

  // If it starts with /objects/, use as-is
  if (fileUrl.startsWith('/objects/')) {
    return fileUrl;
  }

  // For other formats, try to use as objects route
  return `/objects/${fileUrl.replace(/^\/+/, '')}`;
}

/**
 * Document API operations.
 */
export const documentApi = {
  /**
   * Create a new document.
   * @param data - Document data to create.
   * @param _data
   * @returns Promise with the created document.
   */
  create: (_data: Record<string, unknown>) => {
    return apiRequest('POST', '/api/documents', _data);
  },

  /**
   * Update an existing document.
   * @param id - Document ID to update.
   * @param data - Updated document data.
   * @param _data
   * @returns Promise with the updated document.
   */
  update: (id: string, _data: Record<string, unknown>) => {
    return apiRequest('PUT', `/api/documents/${id}`, _data);
  },

  /**
   * Delete a document.
   * @param id - Document ID to delete.
   * @returns Promise with deletion confirmation.
   */
  delete: (id: string) => {
    return apiRequest('DELETE', `/api/documents/${id}`);
  },

  /**
   * Upload a file for a document.
   * @param id - Document ID.
   * @param fileData - File data to upload.
   * @returns Promise with upload result.
   */
  upload: (id: string, fileData: FormData) => {
    return apiRequest('POST', `/api/documents/${id}/upload`, fileData);
  },
};

/**
 * Common upload handler factory.
 * @param documentId - The document ID.
 * @param onSuccess - Success callback.
 * @param onError - Error callback.
 * @returns Upload handler function.
 */
export function createUploadHandler(
  documentId: string,
  onSuccess?: () => void,
  onError?: (_error: Error) => void
) {
  return (_result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      /**
       * If function.
       * @param result.successful && result.successful.length > 0 - result.successful && result.successful.length > 0 parameter.
       */ /**
       * If function.
       * @param result.successful && result.successful.length > 0 - result.successful && result.successful.length > 0 parameter.
       */

      if (_result.successful && _result.successful.length > 0) {
        onSuccess?.();
      } else if (_result.failed && _result.failed.length > 0) {
        /**
         * If function.
         * @param result.failed && result.failed.length > 0 - result.failed && result.failed.length > 0 parameter.
         */ /**
         * If function.
         * @param result.failed && result.failed.length > 0 - result.failed && result.failed.length > 0 parameter.
         */

        const error = new Error(`Upload failed: ${_result.failed[0].error}`);
        onError?.(error);
      }
    } catch (_error) {
      /**
       * Catch function.
       * @param error - Error object.
       */ /**
       * Catch function.
       * @param error - Error object.
       */

      onError?.(_error as Error);
    }
  };
}

/**
 * Get category label by value.
 * @param categories - Array of category objects.
 * @param value - Category value to find.
 * @returns Category label or the original value.
 */
/**
 * Get category label.
 * @param categories - Categories parameter.
 * @param value - Value to process.
 * @param _value
 * @returns String result.
 */
export function /**
 * Get category label.
 * @param categories - Categories parameter.
 * @param value - Value to process.
 * @returns String result.
 */ /**
 * Get category label.
 * @param categories - Categories parameter.
 * @param value - Value to process.
 * @returns String result.
 */

getCategoryLabel(categories: readonly { _value: string; label: string }[], _value: string): string {
  return categories.find((cat) => cat._value === _value)?.label || _value;
}
