import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface FieldConfidence {
  vendorName: number;
  totalAmount: number;
  dueDate: number;
  category: number;
  paymentType: number;
  frequency: number;
}

interface ExtractionResult {
  success: boolean;
  formData?: any;
  confidence?: number;
  fieldConfidence?: FieldConfidence;
  extractionNotes?: string[];
  error?: string;
  rawData?: any;
  isLoading?: boolean;
}

interface GeminiBillExtractorProps {
  /** The bill/receipt file to process with AI extraction */
  file: File | null;
  /** Current language for AI extraction */
  language?: 'en' | 'fr';
  /** Callback function to return extracted data to the parent component */
  onExtractionComplete: (data: ExtractionResult) => void;
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
export function GeminiBillExtractor({ file, language = 'en', onExtractionComplete }: GeminiBillExtractorProps) {
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  
  // Mutation for AI bill data extraction
  // Exception (task #229): extraction emits state-driven UI rather than a single
  // success/error toast pair, so it does not map onto `useCreateUpdateMutation`.
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
          // Retrying extraction - retry logic handled silently
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
      formData.append('language', language);
      
      // Make API request to bill extraction endpoint
      const response = await apiRequest('POST', '/api/bills/extract-data', formData);
      
      // Parse JSON response
      const jsonResponse = await response.json();
      return jsonResponse;
    },
    onSuccess: (data) => {
      // Guard for non-success responses or missing data
      if (!data || !data.success || !data.data) {
        onExtractionComplete({
          success: false,
          error: data?.message || data?.error || 'Failed to extract bill data - invalid response'
        });
        return;
      }
      
      // Convert AI response to form data format for bills
      const formData = convertBillResponseToFormData(data.data);
      
      // Extract field confidence with defaults for missing values
      const rawConfidence = data.data?.fieldConfidence || {};
      const fieldConfidence: FieldConfidence = {
        vendorName: typeof rawConfidence.vendorName === 'number' ? rawConfidence.vendorName : 0.5,
        totalAmount: typeof rawConfidence.totalAmount === 'number' ? rawConfidence.totalAmount : 0.5,
        dueDate: typeof rawConfidence.dueDate === 'number' ? rawConfidence.dueDate : 0.5,
        category: typeof rawConfidence.category === 'number' ? rawConfidence.category : 0.5,
        paymentType: typeof rawConfidence.paymentType === 'number' ? rawConfidence.paymentType : 0.5,
        frequency: typeof rawConfidence.frequency === 'number' ? rawConfidence.frequency : 0.5
      };
      
      const extractionNotes = Array.isArray(data.data?.extractionNotes) ? data.data.extractionNotes : [];
      const overallConfidence = data.data?.overallConfidence || data.metadata?.confidence || 0.9;
      
      // Call the success callback with structured data including confidence info
      onExtractionComplete({
        success: true,
        formData,
        confidence: overallConfidence,
        fieldConfidence,
        extractionNotes,
        rawData: data.data
      });
    },
    onError: (error: any, variables, context) => {
      // Extraction failed - error handling continues
      const failureCount = (error as any)?.failureCount || 0;
      setRetryCount(failureCount);
      
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
      const currentRetries = (error as any)?.failureCount || 0;
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
      // Starting extraction for file - processing begins
      
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
 * Helper function to safely parse an amount (handles both string and number)
 */
function parseAmount(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' && !isNaN(value)) {
    return value.toFixed(2);
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return parsed.toFixed(2);
    }
  }
  return '';
}

/**
 * Convert AI response to form data format suitable for bill forms
 * Maps AI-extracted fields to the expected form structure
 * Now handles the new logical sequence extraction format with field confidence
 */
function convertBillResponseToFormData(aiData: any) {
  try {
    // Handle null or undefined data gracefully
    if (!aiData || typeof aiData !== 'object') {
      return {};
    }
    
    // Map AI payment type to new payment structure
    const paymentTypeMapping = mapPaymentTypeToStructure(aiData.paymentType);
    
    // CRITICAL: Override payment structure if we have custom payment dates or custom frequency
    // This ensures installment plans are correctly detected
    const hasCustomPayments = Array.isArray(aiData.customPaymentDates) && aiData.customPaymentDates.length > 0;
    const isCustomFrequency = aiData.frequency === 'custom';
    
    if (hasCustomPayments || isCustomFrequency) {
      paymentTypeMapping.billType = 'recurrent';
      paymentTypeMapping.paymentStructure = 'installment';
      paymentTypeMapping.paymentCount = 'multiple';
      paymentTypeMapping.recurrence = true;
    }
    
    // Determine category - use AI category if valid, otherwise infer from vendor
    const validCategories = [
      'insurance', 'maintenance', 'salary', 'utilities', 'cleaning', 'security', 
      'landscaping', 'professional_services', 'administration', 'repairs', 
      'supplies', 'taxes', 'technology', 'reserves', 'other'
    ];
    const category = validCategories.includes(aiData.category) 
      ? aiData.category 
      : mapVendorToCategory(aiData.vendorName);
    
    // Create a descriptive title from the extracted data
    let title = '';
    if (aiData.description && aiData.description.length > 0) {
      title = aiData.description;
    } else if (aiData.vendorName) {
      title = `Bill from ${aiData.vendorName}`;
    } else {
      title = 'Extracted Bill';
    }
    
    // Parse the amount safely (handles both string and number)
    const parsedAmount = parseAmount(aiData.totalAmount);
    
    // Build customPayments. Prefer per-payment amounts when the model provides
    // them (newer prompt) and fall back to dividing the total over the dates.
    let customPayments: { amount: string; date: string; description: string }[] = [];
    if (Array.isArray(aiData.customPayments) && aiData.customPayments.length > 0) {
      customPayments = aiData.customPayments.map((p: any, index: number) => ({
        amount: parseAmount(p.amount) || '0.00',
        date: p.date || '',
        description: p.description || `Payment ${index + 1}`,
      })).filter(p => p.date);
    } else if (Array.isArray(aiData.customPaymentDates) && aiData.customPaymentDates.length > 0) {
      const numPayments = aiData.customPaymentDates.length;
      const totalAmount = parseFloat(parsedAmount || '0');
      const individualAmount = numPayments > 0 ? (totalAmount / numPayments).toFixed(2) : parsedAmount;
      customPayments = aiData.customPaymentDates.map((date: string, index: number) => ({
        amount: individualAmount || '0.00',
        date,
        description: `Payment ${index + 1}`,
      }));
    }

    // Map AI response to bill form fields with robust null checking
    const formData: any = {
      title,
      vendor: aiData.vendorName || '',
      singlePaymentAmount: paymentTypeMapping.paymentStructure === 'single' ? parsedAmount : '',
      totalAmount: parsedAmount,
      category,
      billType: paymentTypeMapping.billType,
      paymentStructure: paymentTypeMapping.paymentStructure,
      paymentCount: paymentTypeMapping.paymentCount,
      recurrence: paymentTypeMapping.recurrence,
      description: aiData.description || (aiData.vendorName ? `Bill from ${aiData.vendorName}` : 'Extracted bill'),
      startDate: aiData.dueDate || aiData.startDate || '',
      schedulePayment: mapFrequencyToSchedule(aiData.frequency),
      customPayments,
    };

    // Optional / pass-through fields populated by the newer extraction prompt.
    if (aiData.endDate && paymentTypeMapping.paymentStructure !== 'installment') {
      formData.endDate = aiData.endDate;
    }
    if (aiData.issueDate) formData.issueDate = aiData.issueDate;
    // Vendor's invoice number comes back as either `billNumber` or
    // `invoiceNumber` depending on which prompt branch fired. We never use this
    // for our system-generated bill number; it goes into vendorInvoiceNumber.
    const vendorInvoice = aiData.billNumber || aiData.invoiceNumber;
    if (vendorInvoice) formData.vendorInvoiceNumber = vendorInvoice;

    if (typeof aiData.yearInterval === 'number' && aiData.yearInterval >= 1) {
      formData.yearInterval = aiData.yearInterval;
    }
    if (aiData.hasInitialPayment === true || aiData.initialPaymentAmount) {
      formData.hasInitialPayment = true;
      const initial = parseAmount(aiData.initialPaymentAmount);
      if (initial) formData.initialPaymentAmount = initial;
    }
    const recurringAmount = parseAmount(aiData.recurringPaymentAmount);
    if (recurringAmount) formData.recurringPaymentAmount = recurringAmount;
    if (typeof aiData.recurringPaymentsEqual === 'boolean') {
      formData.recurringPaymentsEqual = aiData.recurringPaymentsEqual;
    } else if (customPayments.length > 1) {
      // Detect unequal installments from the per-payment amounts.
      const first = customPayments[0].amount;
      formData.recurringPaymentsEqual = customPayments.every(p => p.amount === first);
    }

    return formData;
  } catch (error) {
    console.error('Error converting AI response to form data:', error);
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
 * Map AI payment type to new payment structure (billType + paymentStructure)
 * Also returns legacy fields for backward compatibility
 */
function mapPaymentTypeToStructure(aiPaymentType: string): { 
  billType: 'unique' | 'recurrent', 
  paymentStructure: 'single' | 'installment',
  paymentCount: '1' | 'multiple', 
  recurrence: boolean 
} {
  if (!aiPaymentType) {
    return { 
      billType: 'unique',
      paymentStructure: 'single',
      paymentCount: '1', 
      recurrence: false 
    };
  }
  
  const type = aiPaymentType.toLowerCase();
  
  // Determine if it's recurring
  const isRecurring = type.includes('recurring') || type.includes('repeat');
  
  // Determine if it's installment (multiple payments)
  const isInstallment = type.includes('installment') || type.includes('multiple') || type.includes('payment plan');
  
  return {
    billType: isRecurring ? 'recurrent' : 'unique',
    paymentStructure: isInstallment ? 'installment' : 'single',
    paymentCount: isInstallment ? 'multiple' : '1',
    recurrence: isRecurring
  };
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