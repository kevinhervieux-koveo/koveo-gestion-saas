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
  { value: 'bylaw', label: 'Bylaws' },
  { value: 'financial', label: 'Financial' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'legal', label: 'Legal' },
  { value: 'meeting_minutes', label: 'Meeting Minutes' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'permits', label: 'Permits' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * Document categories for residence documents.
 */
export const RESIDENCE_DOCUMENT_CATEGORIES = [
  { value: 'lease', label: 'Lease Documents' },
  { value: 'inspection', label: 'Inspections' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'financial', label: 'Financial' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'legal', label: 'Legal' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'permits', label: 'Permits' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * General document categories for resident use.
 */
export const GENERAL_DOCUMENT_CATEGORIES = [
  { value: 'lease', label: 'Lease Agreement' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'inspection', label: 'Inspections' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'financial', label: 'Financial' },
  { value: 'legal', label: 'Legal Documents' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * Utility function to convert raw object storage URLs to server routes.
 * @param fileUrl - The file URL to convert.
 * @returns The displayable file URL.
 */
/**
 * Get displayable file url.
 * @param fileUrl - fileUrl parameter.
 * @returns String result.
 */
export function  /**
   * Get displayable file url.
   * @param fileUrl - fileUrl parameter.
   * @returns String result.
   */
 getDisplayableFileUrl(fileUrl: string): string {  /**
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
    const bucketIndex = urlParts.findIndex(part => part.includes('googleapis.com'));  /**
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
   * @returns Promise with the created document.
   */
  create: (data: Record<string, unknown>) => {
    return apiRequest('POST', '/api/documents', data);
  },

  /**
   * Update an existing document.
   * @param id - Document ID to update.
   * @param data - Updated document data.
   * @returns Promise with the updated document.
   */
  update: (id: string, data: Record<string, unknown>) => {
    return apiRequest('PUT', `/api/documents/${id}`, data);
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
  onError?: (error: Error) => void
) {
  return (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {  /**
   * If function.
   * @param result.successful && result.successful.length > 0 - result.successful && result.successful.length > 0 parameter.
   */

      if (result.successful && result.successful.length > 0) {
        onSuccess?.();
      } else  /**
   * If function.
   * @param result.failed && result.failed.length > 0 - result.failed && result.failed.length > 0 parameter.
   */
 if (result.failed && result.failed.length > 0) {
        const error = new Error(`Upload failed: ${result.failed[0].error}`);
        onError?.(error);
      }
    }  /**
   * Catch function.
   * @param error - Error object.
   */
 catch (error) {
      onError?.(error as Error);
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
 * @param categories - categories parameter.
 * @param value - Value to process.
 * @returns String result.
 */
export function  /**
   * Get category label.
   * @param categories - categories parameter.
   * @param value - Value to process.
   * @returns String result.
   */
 getCategoryLabel(
  categories: readonly { value: string; label: string }[],
  value: string
): string {
  return categories.find(cat => cat.value === value)?.label || value;
}