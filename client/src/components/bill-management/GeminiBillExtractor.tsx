import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface GeminiBillExtractorProps {
  /** The bill/receipt file to process with AI extraction */
  file: File | null;
  /** Callback function to return extracted data to the parent component */
  onExtractionComplete: (data: {
    success: boolean;
    formData?: any;
    confidence?: number;
    error?: string;
    rawData?: any;
    isLoading?: boolean;
  }) => void;
}

/**
 * GeminiBillExtractor Component
 * 
 * A client-side component that manages AI-powered bill and receipt data extraction.
 * This component does not render any UI - it purely handles the API integration
 * for sending uploaded files to the Gemini AI service for structured data extraction.
 * 
 * Features:
 * - TanStack Query integration with useMutation
 * - Automatic extraction triggering when file changes
 * - Structured error handling and response formatting
 * - Form data conversion for easy integration with react-hook-form
 * - Confidence scoring and extraction metadata
 * - Specialized for bills, receipts, and vendor invoices
 */
export function GeminiBillExtractor({ file, onExtractionComplete }: GeminiBillExtractorProps) {
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  
  // Mutation for AI bill data extraction
  const extractionMutation = useMutation({
    retry: (failureCount, error: any) => {
      // Retry up to maxRetries times for network errors or 5xx errors
      if (failureCount < maxRetries) {
        const isRetryableError = 
          error.message?.includes('Failed to execute \'fetch\'') || 
          error.message?.includes('Network error') ||
          error.message?.includes('500:') ||
          error.message?.includes('502:') ||
          error.message?.includes('503:') ||
          error.message?.includes('504:');
        
        if (isRetryableError) {
          console.log(`[GEMINI BILL EXTRACTOR] Retrying extraction (attempt ${failureCount + 1}/${maxRetries})`);
          return true;
        }
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    mutationFn: async (billFile: File) => {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('invoiceFile', billFile);
      
      // Make API request to bill extraction endpoint
      const response = await apiRequest('POST', '/api/bills/extract-data', formData);
      
      // Parse JSON response
      const jsonResponse = await response.json();
      return jsonResponse;
    },
    onSuccess: (data) => {
      console.log('[GEMINI BILL EXTRACTOR] Extraction successful:', data);
      
      // Convert AI response to form data format for bills
      const formData = convertBillResponseToFormData(data.data);
      
      // Call the success callback with structured data
      onExtractionComplete({
        success: true,
        formData,
        confidence: data.metadata?.confidence,
        rawData: data.data
      });
    },
    onError: (error: any, variables, context) => {
      console.error('[GEMINI BILL EXTRACTOR] Extraction failed:', error);
      setRetryCount(context?.failureCount || 0);
      
      // Handle different error types
      let errorMessage = 'Failed to extract bill data';
      
      // Check if it's a network or fetch error
      if (error.message?.includes('Failed to execute \'fetch\'') || error.name === 'TypeError') {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
      } else if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
        errorMessage = 'Too many extraction requests. Please wait before trying again.';
      } else if (error.message?.includes('UNSUPPORTED_FILE_TYPE')) {
        errorMessage = 'Unsupported file type. Please upload a PDF or image file.';
      } else if (error.message?.includes('FILE_TOO_LARGE')) {
        errorMessage = 'File is too large. Please upload a file smaller than 25MB.';
      } else if (error.message?.includes('GEMINI_API_ERROR')) {
        errorMessage = 'AI service temporarily unavailable. Please try again later.';
      } else if (error.message?.includes('400:') || error.message?.includes('500:')) {
        // Extract server error message from status codes
        const match = error.message.match(/\d+:\s*(.+)/);
        if (match) {
          try {
            const errorData = JSON.parse(match[1]);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            errorMessage = match[1] || errorMessage;
          }
        }
      }
      
      // Add retry information if applicable
      const currentRetries = context?.failureCount || 0;
      if (currentRetries > 0) {
        errorMessage += ` (after ${currentRetries} retry${currentRetries === 1 ? '' : 'ies'})`;
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
    if (file) {
      console.log('[GEMINI BILL EXTRACTOR] Starting extraction for file:', file.name);
      
      // Notify parent that extraction is starting
      onExtractionComplete({
        success: false,
        isLoading: true
      });
      
      extractionMutation.mutate(file);
    }
  }, [file]);

  // This component doesn't render anything - it's purely functional
  return null;
}

/**
 * Convert AI response to form data format suitable for bill forms
 * Maps AI-extracted fields to the expected form structure
 */
function convertBillResponseToFormData(aiData: any) {
  try {
    console.log('[GEMINI BILL EXTRACTOR] Raw AI data for conversion:', aiData);
    
    // Handle null or undefined data gracefully
    if (!aiData || typeof aiData !== 'object') {
      console.warn('[GEMINI BILL EXTRACTOR] AI data is null or invalid:', aiData);
      return {};
    }
    
    // Map AI response to bill form fields with more robust null checking
    const formData = {
      title: aiData.description || aiData.vendorName || 'Extracted Bill',
      vendor: aiData.vendorName || '',
      totalAmount: (aiData.totalAmount !== null && aiData.totalAmount !== undefined) ? aiData.totalAmount.toString() : '',
      category: aiData.category || mapVendorToCategory(aiData.vendorName),
      paymentType: mapPaymentType(aiData.paymentType),
      description: aiData.description || (aiData.vendorName ? `Bill from ${aiData.vendorName}` : 'Extracted bill'),
      startDate: aiData.dueDate || aiData.startDate || '',
      endDate: aiData.endDate || '',
      schedulePayment: mapFrequencyToSchedule(aiData.frequency),
      customPayments: aiData.customPaymentDates?.map((date: string, index: number) => ({
        amount: (aiData.totalAmount || 0).toString(),
        date: date,
        description: `Payment ${index + 1}`
      })) || []
    };

    console.log('[GEMINI BILL EXTRACTOR] Converted form data:', formData);
    return formData;
  } catch (error) {
    console.error('[GEMINI BILL EXTRACTOR] Error converting AI response:', error);
    return {};
  }
}

/**
 * Map vendor name to appropriate bill category
 */
function mapVendorToCategory(vendorName: string): string {
  if (!vendorName) return 'other';
  
  const vendor = vendorName.toLowerCase();
  
  if (vendor.includes('hydro') || vendor.includes('electric') || vendor.includes('energy')) {
    return 'utilities';
  } else if (vendor.includes('gas') || vendor.includes('natural gas')) {
    return 'utilities';
  } else if (vendor.includes('water') || vendor.includes('aqua')) {
    return 'utilities';
  } else if (vendor.includes('insurance')) {
    return 'insurance';
  } else if (vendor.includes('security') || vendor.includes('alarm')) {
    return 'security';
  } else if (vendor.includes('clean') || vendor.includes('janitor')) {
    return 'cleaning';
  } else if (vendor.includes('lawn') || vendor.includes('garden') || vendor.includes('landscape')) {
    return 'landscaping';
  } else if (vendor.includes('repair') || vendor.includes('fix')) {
    return 'repairs';
  } else if (vendor.includes('maintenance')) {
    return 'maintenance';
  } else if (vendor.includes('professional') || vendor.includes('consulting')) {
    return 'professional_services';
  } else if (vendor.includes('supplies') || vendor.includes('material')) {
    return 'supplies';
  } else if (vendor.includes('tax') || vendor.includes('government')) {
    return 'taxes';
  } else if (vendor.includes('technology') || vendor.includes('software') || vendor.includes('internet')) {
    return 'technology';
  }
  
  return 'other';
}

/**
 * Map AI payment type to form payment type
 */
function mapPaymentType(aiPaymentType: string): string {
  if (!aiPaymentType) return 'unique';
  
  const type = aiPaymentType.toLowerCase();
  if (type.includes('recurring') || type.includes('repeat')) {
    return 'recurrent';
  }
  
  return 'unique';
}

/**
 * Map AI frequency to form schedule payment
 */
function mapFrequencyToSchedule(frequency: string): string {
  if (!frequency) return 'monthly';
  
  const freq = frequency.toLowerCase();
  
  if (freq.includes('month')) return 'monthly';
  if (freq.includes('quarter')) return 'quarterly';
  if (freq.includes('year') || freq.includes('annual')) return 'yearly';
  if (freq.includes('week')) return 'weekly';
  if (freq.includes('custom')) return 'custom';
  
  return 'monthly';
}