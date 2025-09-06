import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AiExtractionResponse, convertAiResponseToFormData } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

interface GeminiInvoiceExtractorProps {
  /** The invoice file to process with AI extraction */
  file: File | null;
  /** Callback function to return extracted data to the parent component */
  onExtractionComplete: (data: {
    success: boolean;
    formData?: any;
    confidence?: number;
    error?: string;
    rawData?: AiExtractionResponse;
  }) => void;
}

/**
 * GeminiInvoiceExtractor Component
 * 
 * A client-side component that manages AI-powered invoice data extraction.
 * This component does not render any UI - it purely handles the API integration
 * for sending uploaded files to the Gemini AI service for structured data extraction.
 * 
 * Features:
 * - TanStack Query integration with useMutation
 * - Automatic extraction triggering when file changes
 * - Structured error handling and response formatting
 * - Form data conversion for easy integration with react-hook-form
 * - Confidence scoring and extraction metadata
 */
export function GeminiInvoiceExtractor({ file, onExtractionComplete }: GeminiInvoiceExtractorProps) {
  
  // Mutation for AI invoice data extraction
  const extractionMutation = useMutation({
    mutationFn: async (invoiceFile: File) => {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('invoiceFile', invoiceFile);
      
      // Make API request to extraction endpoint
      const response = await apiRequest('/api/invoices/extract-data', {
        method: 'POST',
        body: formData,
        // Note: Don't set Content-Type header - let browser set it for FormData
      });
      
      return response;
    },
    onSuccess: (data) => {
      console.log('[GEMINI EXTRACTOR] Extraction successful:', data);
      
      // Convert AI response to form data format
      const formData = convertAiResponseToFormData(data.data);
      
      // Call the success callback with structured data
      onExtractionComplete({
        success: true,
        formData,
        confidence: data.metadata?.confidence,
        rawData: data.data
      });
    },
    onError: (error: any) => {
      console.error('[GEMINI EXTRACTOR] Extraction failed:', error);
      
      // Handle different error types
      let errorMessage = 'Failed to extract invoice data';
      
      if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
        errorMessage = 'Too many extraction requests. Please wait before trying again.';
      } else if (error.message?.includes('UNSUPPORTED_FILE_TYPE')) {
        errorMessage = 'Unsupported file type. Please upload a PDF or image file.';
      } else if (error.message?.includes('FILE_TOO_LARGE')) {
        errorMessage = 'File is too large. Please upload a file smaller than 25MB.';
      } else if (error.message?.includes('SERVICE_UNAVAILABLE')) {
        errorMessage = 'AI extraction service is currently unavailable. Please try again later.';
      }
      
      // Call the error callback
      onExtractionComplete({
        success: false,
        error: errorMessage
      });
    }
  });
  
  // Trigger extraction when file changes
  useEffect(() => {
    if (file && !extractionMutation.isPending) {
      console.log('[GEMINI EXTRACTOR] Starting extraction for file:', file.name);
      extractionMutation.mutate(file);
    }
  }, [file, extractionMutation.isPending]);
  
  // This component doesn't render anything - it's purely for side effects
  return null;
}

// Export the component type for reuse
export type { GeminiInvoiceExtractorProps };