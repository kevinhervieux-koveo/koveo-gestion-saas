import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Sparkles, Plus, X, Calendar } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { SharedUploader } from '@/components/document-management';
import { GeminiBillExtractor } from './GeminiBillExtractor';
import { AttachedFileSection } from '@/components/common/AttachedFileSection';
import type { AttachedFile } from '@/components/common/StandardDocumentAttachments';
import type { Bill, Document } from '@shared/schema';
import type { UploadContext } from '@shared/config/upload-config';
import { BILL_CATEGORIES } from '@shared/schemas/financial';

// Unified form schema with smart payment logic
const billFormSchema = z.object({
  title: z.string().min(1, 'Bill title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  category: z.enum(BILL_CATEGORIES),
  vendor: z.string().max(150, 'Vendor name must be less than 150 characters').optional(),
  paymentCount: z.enum(['1', 'multiple']),
  recurrence: z.boolean().default(false),
  paymentType: z.enum(['unique', 'recurrent']).optional(),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  hasInitialPayment: z.boolean().optional(),
  recurringPaymentsEqual: z.boolean().optional(),
  singlePaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Payment amount must be between $0.01 and $999,999.99'),
  initialPaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Initial payment amount must be between $0.01 and $999,999.99'),
  recurringPaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Recurring payment amount must be between $0.01 and $999,999.99'),
  customPayments: z.array(z.object({
    amount: z.string().min(1, 'Amount is required').refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 999999.99;
    }, 'Amount must be between $0.01 and $999,999.99'),
    date: z.string().min(1, 'Date is required').refine((val) => {
      return !isNaN(Date.parse(val));
    }, 'Date must be a valid date'),
    description: z.string().optional()
  })).optional(),
  totalAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Total amount must be between $0.01 and $999,999.99'),
  startDate: z.string().min(1, 'Start date is required').refine((val) => {
    return !isNaN(Date.parse(val));
  }, 'Start date must be a valid date'),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, 'End date must be a valid date'),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
}).superRefine((data, ctx) => {
  // Custom validation logic for payment structure with specific field error targeting
  if (data.paymentCount === '1') {
    // For single payment, singlePaymentAmount is required
    if (!data.singlePaymentAmount || data.singlePaymentAmount.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment amount is required for single payment bills',
        path: ['singlePaymentAmount']
      });
    }
  } else if (data.paymentCount === 'multiple') {
    // For multiple payments, validate based on recurrence and configuration
    if (!data.recurrence) {
      // Multiple payments without recurrence - validate payment structure
      if (data.hasInitialPayment && (!data.initialPaymentAmount || data.initialPaymentAmount.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Initial payment amount is required when initial payment is enabled',
          path: ['initialPaymentAmount']
        });
      }
      if (data.recurringPaymentsEqual && (!data.recurringPaymentAmount || data.recurringPaymentAmount.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Payment amount is required for equal payments',
          path: ['recurringPaymentAmount']
        });
      }
      if (!data.recurringPaymentsEqual && (!data.customPayments || data.customPayments.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one payment is required for unequal payments',
          path: ['customPayments']
        });
      }
    } else {
      // Multiple payments with recurrence - validate recurring payment structure
      if (data.hasInitialPayment && (!data.initialPaymentAmount || data.initialPaymentAmount.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Initial payment amount is required when initial payment is enabled',
          path: ['initialPaymentAmount']
        });
      }
      if (data.recurringPaymentsEqual && (!data.recurringPaymentAmount || data.recurringPaymentAmount.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Recurring payment amount is required for equal recurring payments',
          path: ['recurringPaymentAmount']
        });
      }
      if (!data.recurringPaymentsEqual && (!data.customPayments || data.customPayments.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one custom payment is required for unequal recurring payments',
          path: ['customPayments']
        });
      }
    }
  }
});

type BillFormData = z.infer<typeof billFormSchema>;

type CustomPayment = {
  amount: string;
  date: string;
  description?: string;
};

interface ModularBillFormProps {
  bill?: Bill | null;
  onSuccess?: (billId: string, action: 'created' | 'updated') => void;
  onCancel?: () => void;
  buildingId?: string;
}

// Create dropdown options from shared categories
const CATEGORY_OPTIONS = BILL_CATEGORIES.map(category => ({
  value: category,
  label: category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}));

// Helper function to parse existing bill payment data for form initialization
function parseBillPaymentData(bill: Bill | null | undefined) {
  if (!bill) {
    return {
      paymentCount: '1' as const,
      recurrence: false,
      schedulePayment: 'monthly' as const,
      hasInitialPayment: false,
      recurringPaymentsEqual: true,
      singlePaymentAmount: '',
      initialPaymentAmount: '',
      recurringPaymentAmount: '',
      customPayments: [] as CustomPayment[],
    };
  }

  const costs = bill.costs || [];
  const scheduleCustom = bill.scheduleCustom || [];
  const paymentType = bill.paymentType;

  // Determine paymentCount and recurrence based on paymentType and costs
  let paymentCount: '1' | 'multiple' = '1';
  let recurrence = false;
  
  if (paymentType === 'recurrent') {
    paymentCount = 'multiple';
    recurrence = true;
  } else if (paymentType === 'unique' && costs.length > 1) {
    paymentCount = 'multiple';
    recurrence = false;
  }

  // Default values for payment structure
  let singlePaymentAmount = '';
  let hasInitialPayment = false;
  let recurringPaymentsEqual = true;
  let initialPaymentAmount = '';
  let recurringPaymentAmount = '';
  let customPayments: CustomPayment[] = [];

  // Handle single payment case
  if (paymentType === 'unique' && costs.length === 1) {
    singlePaymentAmount = costs[0].toString();
  } else if (paymentType === 'recurrent' && costs.length > 0) {
    // Determine payment structure based on costs array
    if (costs.length === 1) {
      // Single recurring payment
      recurringPaymentAmount = costs[0].toString();
    } else if (costs.length > 1) {
      // Multiple payments - check if first is different (initial payment)
      const firstCost = parseFloat(costs[0].toString());
      const otherCosts = costs.slice(1).map(c => parseFloat(c.toString()));
      
      // Check if first payment is different from others (likely initial payment)
      const allOthersEqual = otherCosts.every(cost => cost === otherCosts[0]);
      const firstDifferent = firstCost !== otherCosts[0];
      
      if (firstDifferent && allOthersEqual && otherCosts.length > 0) {
        // First payment is different - treat as initial payment
        hasInitialPayment = true;
        initialPaymentAmount = firstCost.toString();
        recurringPaymentAmount = otherCosts[0].toString();
      } else if (allOthersEqual && costs.every(c => parseFloat(c.toString()) === firstCost)) {
        // All payments are equal
        recurringPaymentAmount = firstCost.toString();
      } else {
        // Unequal payments - use custom structure
        recurringPaymentsEqual = false;
        
        // Convert costs and scheduleCustom to customPayments format
        customPayments = costs.map((cost, index) => ({
          amount: cost.toString(),
          date: scheduleCustom[index] || '', // Use corresponding date if available
          description: `Payment ${index + 1}`,
        }));
      }
    }
  }

  return {
    paymentCount,
    recurrence,
    schedulePayment: bill.schedulePayment || 'monthly' as const,
    hasInitialPayment,
    recurringPaymentsEqual,
    singlePaymentAmount,
    initialPaymentAmount,
    recurringPaymentAmount,
    customPayments,
  };
}

export default function ModularBillForm({ bill, onSuccess, onCancel, buildingId }: ModularBillFormProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Parse existing bill payment data
  const parsedPaymentData = parseBillPaymentData(bill);
  
  // State for AI extraction
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiExtractionData, setAiExtractionData] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true); // AI enabled by default for bills
  
  // State for document management
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [customPayments, setCustomPayments] = useState<CustomPayment[]>(parsedPaymentData.customPayments);
  
  // Auto-save functionality
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  
  
  // Upload context for secure storage
  const uploadContext: UploadContext = {
    type: 'bills',
    organizationId: 'default', // Would be dynamic based on user's org
    buildingId,
    userRole: 'admin', // Would be dynamic based on user's role
    userId: 'current-user' // Would be dynamic based on current user
  };

  // Form setup with properly populated defaultValues
  const form = useForm<BillFormData>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      title: bill?.title || '',
      description: bill?.description || '',
      category: bill?.category || 'other',
      vendor: bill?.vendor || '',
      paymentCount: parsedPaymentData.paymentCount,
      recurrence: parsedPaymentData.recurrence,
      paymentType: bill?.paymentType || 'unique',
      schedulePayment: parsedPaymentData.schedulePayment,
      customPayments: parsedPaymentData.customPayments,
      hasInitialPayment: parsedPaymentData.hasInitialPayment,
      recurringPaymentsEqual: parsedPaymentData.recurringPaymentsEqual,
      singlePaymentAmount: parsedPaymentData.singlePaymentAmount,
      initialPaymentAmount: parsedPaymentData.initialPaymentAmount,
      recurringPaymentAmount: parsedPaymentData.recurringPaymentAmount,
      totalAmount: bill?.totalAmount?.toString() || '',
      startDate: bill?.startDate || '',
      endDate: bill?.endDate || '',
      status: bill?.status || 'draft',
      notes: bill?.notes || '',
    }
  });

  const paymentCount = form.watch('paymentCount');
  const recurrence = form.watch('recurrence');
  const paymentType = form.watch('paymentType');
  const schedulePayment = form.watch('schedulePayment');
  const hasInitialPayment = form.watch('hasInitialPayment');
  const recurringPaymentsEqual = form.watch('recurringPaymentsEqual');
  const singlePaymentAmount = form.watch('singlePaymentAmount');
  const initialPaymentAmount = form.watch('initialPaymentAmount');
  const recurringPaymentAmount = form.watch('recurringPaymentAmount');
  const watchedCustomPayments = form.watch('customPayments');

  // Calculate total amount based on payment structure
  const calculatedTotal = React.useMemo(() => {
    if (paymentCount === '1') {
      // For single payment, total equals the singlePaymentAmount
      return parseFloat(singlePaymentAmount || '0');
    } else if (paymentCount === 'multiple') {
      let total = 0;
      
      if (recurringPaymentsEqual) {
        // For equal recurring payments
        const maxPayments = 12; // Default to 12 monthly payments
        
        if (hasInitialPayment && initialPaymentAmount) {
          total += parseFloat(initialPaymentAmount || '0');
          
          if (recurringPaymentAmount) {
            // Add remaining payments (12 - 1 = 11)
            total += parseFloat(recurringPaymentAmount || '0') * (maxPayments - 1);
          }
        } else if (recurringPaymentAmount) {
          // All payments use the same recurring amount
          total += parseFloat(recurringPaymentAmount || '0') * maxPayments;
        }
      } else if (watchedCustomPayments && watchedCustomPayments.length > 0) {
        // For custom payments, sum all amounts
        total = watchedCustomPayments.reduce((sum, payment) => {
          return sum + parseFloat(payment.amount || '0');
        }, 0);
      }
      
      return total;
    }
    
    return 0;
  }, [
    paymentCount,
    singlePaymentAmount,
    hasInitialPayment,
    initialPaymentAmount,
    recurringPaymentsEqual,
    recurringPaymentAmount,
    watchedCustomPayments
  ]);

  // Update form's totalAmount field with calculated value - ALWAYS set for ALL cases
  useEffect(() => {
    const totalStr = calculatedTotal.toFixed(2);
    
    // Only update if the value has changed to avoid unnecessary re-renders
    if (form.getValues('totalAmount') !== totalStr) {
      form.setValue('totalAmount', totalStr, { shouldValidate: false });
    }
  }, [calculatedTotal, form]);

  // Auto-save function with 1.5 second delay
  const performAutoSave = useCallback(async (formData: BillFormData) => {
    try {
      setIsAutoSaving(true);
      setAutoSaveStatus('Saving...');
      
      const currentDataString = JSON.stringify(formData);
      
      // Skip save if data hasn't changed
      if (currentDataString === lastSavedDataRef.current) {
        setIsAutoSaving(false);
        setAutoSaveStatus('No changes');
        setTimeout(() => setAutoSaveStatus(null), 2000);
        return;
      }

      // Only auto-save if we're editing an existing bill
      if (bill?.id) {
        // Map paymentCount + recurrence to paymentType for database
        let paymentType: 'unique' | 'recurrent';
        if (formData.paymentCount === '1') {
          paymentType = 'unique';
        } else if (formData.paymentCount === 'multiple' && formData.recurrence) {
          paymentType = 'recurrent';
        } else {
          paymentType = 'unique'; // multiple payments without recurrence
        }
        
        // Calculate costs array based on payment structure (same logic as main submit)
        let costs: string[] = [];
        let calculatedTotalAmount = formData.totalAmount;
        
        if (formData.paymentCount === '1') {
          costs = [formData.singlePaymentAmount || '0'];
        } else if (formData.paymentCount === 'multiple') {
          if (formData.recurringPaymentsEqual) {
            const maxPayments = 12;
            
            if (formData.hasInitialPayment && formData.initialPaymentAmount) {
              costs.push(formData.initialPaymentAmount);
              if (formData.recurringPaymentAmount) {
                for (let i = 1; i < maxPayments; i++) {
                  costs.push(formData.recurringPaymentAmount);
                }
              }
            } else if (formData.recurringPaymentAmount) {
              for (let i = 0; i < maxPayments; i++) {
                costs.push(formData.recurringPaymentAmount);
              }
            }
          } else if (formData.customPayments && formData.customPayments.length > 0) {
            costs = formData.customPayments.map(p => p.amount).filter(a => a && a.trim() !== '');
          }
          
          if (!calculatedTotalAmount || calculatedTotalAmount.trim() === '') {
            const total = costs.reduce((sum, cost) => sum + parseFloat(cost || '0'), 0);
            calculatedTotalAmount = total.toString();
          }
        }
        
        let scheduleCustom: string[] = [];
        if (formData.paymentCount === 'multiple' && !formData.recurringPaymentsEqual && formData.customPayments) {
          scheduleCustom = formData.customPayments
            .map(p => p.date)
            .filter(d => d && d.trim() !== '');
        }
        
        const billData = {
          ...formData,
          paymentType, // Use the mapped paymentType for the database
          buildingId: buildingId || bill.buildingId,
          totalAmount: calculatedTotalAmount,
          costs,
          scheduleCustom,
          paymentStructure: {
            hasInitialPayment: formData.hasInitialPayment,
            recurringPaymentsEqual: formData.recurringPaymentsEqual,
            initialPaymentAmount: formData.initialPaymentAmount,
            recurringPaymentAmount: formData.recurringPaymentAmount,
            customPayments: formData.customPayments,
          },
        };

        const response = await apiRequest('PUT', `/api/bills/${bill.id}`, billData);
        
        if (response.ok) {
          lastSavedDataRef.current = currentDataString;
          setAutoSaveStatus('Saved');
          
          // Invalidate queries to refresh any related data
          queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
        } else {
          throw new Error('Failed to auto-save');
        }
      } else {
        // For new bills, just update the status
        setAutoSaveStatus('Draft');
      }
      
      setIsAutoSaving(false);
      
      // Clear status after 3 seconds
      setTimeout(() => setAutoSaveStatus(null), 3000);
      
    } catch (error) {
      console.error('Auto-save failed:', error);
      setIsAutoSaving(false);
      setAutoSaveStatus('Save failed');
      setTimeout(() => setAutoSaveStatus(null), 3000);
    }
  }, [bill?.id, buildingId, queryClient]);

  // Debounced auto-save function with 1.5 second delay
  const debouncedAutoSave = useCallback((formData: BillFormData) => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer for 1.5 seconds (1500ms)
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave(formData);
    }, 1500);
  }, [performAutoSave]);

  // Query for attached documents when editing an existing bill
  const { data: attachedDocuments = [] } = useQuery<Document[]>({
    queryKey: ['/api/documents', { attachedToType: 'bill', attachedToId: bill?.id }],
    queryFn: async () => {
      if (!bill?.id) return [];
      
      // Fetching attached documents for bill
      
      const response = await fetch(`/api/documents?attachedToType=bill&attachedToId=${bill.id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch attached documents');
      }
      
      const data = await response.json();
      // Attached documents received
      return Array.isArray(data.documents) ? data.documents : [];
    },
    enabled: !!bill?.id
  });

  // Sync customPayments state and form values when bill changes
  useEffect(() => {
    const newParsedData = parseBillPaymentData(bill);
    setCustomPayments(newParsedData.customPayments);
    
    // Update form values if bill has changed
    if (bill) {
      form.setValue('paymentCount', newParsedData.paymentCount);
      form.setValue('recurrence', newParsedData.recurrence);
      form.setValue('schedulePayment', newParsedData.schedulePayment);
      form.setValue('hasInitialPayment', newParsedData.hasInitialPayment);
      form.setValue('recurringPaymentsEqual', newParsedData.recurringPaymentsEqual);
      form.setValue('singlePaymentAmount', newParsedData.singlePaymentAmount);
      form.setValue('initialPaymentAmount', newParsedData.initialPaymentAmount);
      form.setValue('recurringPaymentAmount', newParsedData.recurringPaymentAmount);
      form.setValue('customPayments', newParsedData.customPayments);
    }
  }, [bill?.id, form]);

  // Watch for form changes and trigger auto-save
  useEffect(() => {
    const subscription = form.watch((data) => {
      // Trigger auto-save on any form change (with 1.5 second debounce)
      if (data && Object.keys(data).length > 0) {
        debouncedAutoSave(data as BillFormData);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, debouncedAutoSave]);


  // Handle AI extraction results
  const handleAiExtractionComplete = (data: any) => {
    // Handle loading state
    if (data.isLoading) {
      setIsExtracting(true);
      toast({
        title: 'AI Extraction Started',
        description: 'Processing your document... This may take a few seconds.',
      });
      return;
    }
    
    // Clear loading state
    setIsExtracting(false);
    
    if (data.success && data.formData) {
      setAiExtractionData(data.formData);
      
      // Auto-fill form with AI data
      Object.entries(data.formData).forEach(([key, value]) => {
        if (key === 'customPayments' && Array.isArray(value)) {
          setCustomPayments(value);
          form.setValue('customPayments', value);
        } else if (value && typeof value === 'string') {
          form.setValue(key as keyof BillFormData, value);
        }
      });

      toast({
        title: 'AI Extraction Complete',
        description: `Successfully extracted bill data with ${Math.round((data.confidence || 0.9) * 100)}% confidence`,
      });
    } else {
      toast({
        title: 'AI Extraction Failed',
        description: data.error || 'Failed to extract bill data',
        variant: 'destructive',
      });
    }
  };

  // Handle AI toggle
  const handleAiToggle = (enabled: boolean) => {
    setAiEnabled(enabled);
    if (!enabled) {
      setAiExtractionData(null);
      setIsExtracting(false);
    }
  };
  
  // Handle AI analysis completion
  const handleAiAnalysisComplete = (analysisData: any) => {
    if (analysisData.success) {
      setAiExtractionData(analysisData.extractedData);
      setIsExtracting(false);
      
      // Auto-populate form with extracted data
      if (analysisData.extractedData) {
        const data = analysisData.extractedData;
        if (data.title) form.setValue('title', data.title);
        if (data.vendor) form.setValue('vendor', data.vendor);
        if (data.amount) form.setValue('totalAmount', data.amount.toString());
        if (data.category) form.setValue('category', data.category);
        if (data.date) form.setValue('startDate', data.date);
        if (data.description) form.setValue('description', data.description);
      }
      
      toast({
        title: 'AI Analysis Complete',
        description: 'Bill data has been extracted and populated in the form.',
      });
    } else {
      setIsExtracting(false);
      toast({
        title: 'AI Analysis Failed',
        description: analysisData.error || 'Failed to analyze document',
        variant: 'destructive',
      });
    }
  };

  // Handle file upload from SharedUploader
  const handleFileUpload = (file: File | null, text: string | null) => {
    if (file) {
      // Add file to attachments list
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const isImage = file.type.startsWith('image/');
      
      const newAttachment: AttachedFile = {
        id: fileId,
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
        uploadProgress: 0,
        aiAnalyzed: aiEnabled,
        category: getCategoryFromFileName(file.name)
      };
      
      setAttachedFiles(prev => [...prev, newAttachment]);
      
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
      }, 200);
      
      if (aiEnabled) {
        setAiFile(file);
        setIsAiMode(true);
        setIsExtracting(true);
      }
    } else if (text) {
      // Handle text content - create a virtual file for text document
      // Text content received from file
      
      // Create a Blob from the text content
      const textBlob = new Blob([text], { type: 'text/plain' });
      const textFile = new File([textBlob], `bill-notes-${Date.now()}.txt`, { type: 'text/plain' });
      
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newAttachment: AttachedFile = {
        id: fileId,
        file: textFile,
        preview: undefined, // No preview for text files
        uploadProgress: 0,
        aiAnalyzed: false, // Text documents don't get AI analyzed
        category: 'document'
      };
      
      setAttachedFiles(prev => [...prev, newAttachment]);
      
      // Simulate upload progress for consistency
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
      }, 200);
      
      toast({
        title: 'Text Document Added',
        description: 'Your text content has been prepared for saving with the bill.',
      });
    }
  };

  // Remove file from attachments
  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
    setUploadProgress(prev => {
      const { [fileId]: removed, ...rest } = prev;
      return rest;
    });
  };

  // Get category from file name
  const getCategoryFromFileName = (fileName: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.includes('invoice') || lower.includes('bill')) return 'invoice';
    if (lower.includes('receipt')) return 'receipt';
    if (lower.includes('contract')) return 'contract';
    if (lower.includes('quote') || lower.includes('estimate')) return 'quote';
    return 'document';
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Create/Update bill mutation
  const billMutation = useMutation({
    mutationFn: async (data: BillFormData) => {
      const endpoint = bill ? `/api/bills/${bill.id}` : '/api/bills';
      const method = bill ? 'PUT' : 'POST';
      
      // Map paymentCount + recurrence to paymentType for database
      let paymentType: 'unique' | 'recurrent';
      if (data.paymentCount === '1') {
        paymentType = 'unique';
      } else if (data.paymentCount === 'multiple' && data.recurrence) {
        paymentType = 'recurrent';
      } else {
        paymentType = 'unique'; // multiple payments without recurrence
      }
      
      // Calculate costs array based on payment structure
      let costs: string[] = [];
      let calculatedTotalAmount = data.totalAmount;
      
      if (data.paymentCount === '1') {
        costs = [data.singlePaymentAmount || '0'];
      } else if (data.paymentCount === 'multiple') {
        if (data.recurringPaymentsEqual) {
          // For equal recurring payments - generate all 12 payment amounts
          const maxPayments = 12; // Default to 12 monthly payments
          
          if (data.hasInitialPayment && data.initialPaymentAmount) {
            // First payment is the initial amount
            costs.push(data.initialPaymentAmount);
            
            // Remaining payments use the recurring amount
            if (data.recurringPaymentAmount) {
              for (let i = 1; i < maxPayments; i++) {
                costs.push(data.recurringPaymentAmount);
              }
            }
          } else if (data.recurringPaymentAmount) {
            // All payments use the same recurring amount
            for (let i = 0; i < maxPayments; i++) {
              costs.push(data.recurringPaymentAmount);
            }
          }
        } else if (data.customPayments && data.customPayments.length > 0) {
          // For custom amounts
          costs = data.customPayments.map(p => p.amount).filter(a => a && a.trim() !== '');
        }
        
        // Calculate total if not provided
        if (!calculatedTotalAmount || calculatedTotalAmount.trim() === '') {
          const total = costs.reduce((sum, cost) => sum + parseFloat(cost || '0'), 0);
          calculatedTotalAmount = total.toString();
        }
      }
      
      // Extract custom schedule dates for backend persistence
      let scheduleCustom: string[] = [];
      if (data.paymentCount === 'multiple' && !data.recurringPaymentsEqual && data.customPayments) {
        scheduleCustom = data.customPayments
          .map(p => p.date)
          .filter(d => d && d.trim() !== '');
      }
      
      const billData = {
        ...data,
        paymentType, // Use the mapped paymentType for the database
        buildingId: buildingId || bill?.buildingId,
        totalAmount: calculatedTotalAmount,
        costs,
        scheduleCustom, // Send custom dates to backend for persistence
        // Include the new payment structure fields
        paymentStructure: {
          hasInitialPayment: data.hasInitialPayment,
          recurringPaymentsEqual: data.recurringPaymentsEqual,
          initialPaymentAmount: data.initialPaymentAmount,
          recurringPaymentAmount: data.recurringPaymentAmount,
          customPayments: data.customPayments,
        },
      };

      const response = await apiRequest(method, endpoint, billData);
      const billResponse = await response.json();
      
      // Upload attached documents if any
      const fileToUpload = aiFile;
      if (!bill && (fileToUpload || attachedFiles.length > 0)) {
        try {
          if (fileToUpload) {
            // Handle file upload
            // Uploading document for bill
            const formData = new FormData();
            formData.append('document', fileToUpload);
            
            const uploadResponse = await fetch(`/api/bills/${billResponse.id}/upload-document`, {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });
            
            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              console.error('[BILL FORM] Upload failed with status:', uploadResponse.status, errorText);
              throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
            }
            
            const uploadResult = await uploadResponse.json();
            // Document upload successful
            
            // Update the bill response with the document information from the upload
            if (uploadResult.bill) {
              billResponse.filePath = uploadResult.bill.filePath;
              billResponse.fileName = uploadResult.bill.fileName;
              billResponse.fileSize = uploadResult.bill.fileSize;
              billResponse.isAiAnalyzed = uploadResult.bill.isAiAnalyzed;
              billResponse.aiAnalysisData = uploadResult.bill.aiAnalysisData;
            }
            
            // Show success toast for document upload
            toast({
              title: 'Document Uploaded',
              description: `${fileToUpload.name} has been attached to the bill`,
            });
          } else if (attachedFiles.some(f => f.file.type === 'text/plain')) {
            // Handle text document from attached files
            const textFile = attachedFiles.find(f => f.file.type === 'text/plain');
            if (textFile) {
              // Creating text document for bill
              const formData = new FormData();
              formData.append('file', textFile.file);
            formData.append('name', `${billResponse.billNumber || billResponse.title} - Notes`);
            formData.append('description', 'Text document created for bill');
            formData.append('documentType', 'other');
            formData.append('attachedToType', 'bill');
            formData.append('attachedToId', billResponse.id);
            
            const uploadResponse = await fetch('/api/documents/upload', {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });
            
            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              console.error('[BILL FORM] Text document creation failed with status:', uploadResponse.status, errorText);
              throw new Error(`Text document creation failed: ${uploadResponse.status} ${errorText}`);
            }
            
            const uploadResult = await uploadResponse.json();
            // Text document creation successful
            
            // Show success toast for text document creation
            toast({
              title: 'Text Document Created',
              description: 'Your text content has been saved as a document attached to the bill',
            });
            }
          }
        } catch (uploadError) {
          console.error('[BILL FORM] Failed to upload/create document:', uploadError);
          const contentType = fileToUpload ? 'file' : 'text document';
          toast({
            title: 'Document Creation Failed',
            description: `Failed to create ${contentType}. The bill was created but without the document.`,
            variant: 'destructive',
          });
          // Don't fail the bill creation if document upload/creation fails
        }
      }
      
      return billResponse;
    },
    onSuccess: (data) => {
      // Invalidate all bill-related queries to ensure proper refresh
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
      if (buildingId) {
        queryClient.invalidateQueries({ queryKey: ['/api/bills', buildingId] });
        queryClient.invalidateQueries({ queryKey: ['/api/bills/year-range', buildingId] });
      }
      toast({
        title: 'Success',
        description: `Bill ${bill ? 'updated' : 'created'} successfully`,
      });
      onSuccess?.(data.id, bill ? 'updated' : 'created');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${bill ? 'update' : 'create'} bill`,
        variant: 'destructive',
      });
    }
  });

  // Delete bill mutation
  const deleteBillMutation = useMutation({
    mutationFn: async () => {
      if (!bill?.id) throw new Error('No bill ID provided for deletion');
      return apiRequest('DELETE', `/api/bills/${bill.id}`, null);
    },
    onSuccess: () => {
      // Invalidate all bill-related queries to ensure proper refresh
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
      if (buildingId) {
        queryClient.invalidateQueries({ queryKey: ['/api/bills', buildingId] });
        queryClient.invalidateQueries({ queryKey: ['/api/bills/year-range', buildingId] });
      }
      toast({
        title: 'Success',
        description: 'Bill deleted successfully',
      });
      onSuccess?.(bill!.id, 'updated'); // Trigger parent refresh
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete bill',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: BillFormData) => {
    billMutation.mutate(data);
  };

  const handleDelete = () => {
    if (!bill) return;
    
    if (confirm(`Are you sure you want to delete bill "${bill.title}"? This action cannot be undone.`)) {
      deleteBillMutation.mutate();
    }
  };

  // Helper function to generate next payment date based on schedule
  const generateNextPaymentDate = (startDate: string, schedule: string, paymentIndex: number): string => {
    if (!startDate || !schedule) return '';
    
    const start = new Date(startDate);
    const endDate = form.getValues('endDate');
    
    // Calculate proper renewal date: endDate or startDate + 1 year
    let maxDate: Date;
    if (endDate && endDate.trim() !== '') {
      maxDate = new Date(endDate);
    } else {
      maxDate = new Date(start);
      maxDate.setFullYear(start.getFullYear() + 1);
    }
    
    let nextDate = new Date(start);
    
    switch (schedule) {
      case 'weekly':
        nextDate.setDate(start.getDate() + (paymentIndex * 7));
        break;
      case 'monthly':
        nextDate.setMonth(start.getMonth() + paymentIndex);
        break;
      case 'quarterly':
        nextDate.setMonth(start.getMonth() + (paymentIndex * 3));
        break;
      case 'yearly':
        nextDate.setFullYear(start.getFullYear() + paymentIndex);
        break;
      default:
        return '';
    }
    
    // Don't generate dates beyond the bill's renewal period
    if (nextDate >= maxDate) {
      return '';
    }
    
    return nextDate.toISOString().split('T')[0];
  };

  // Custom Payment Management
  const addCustomPayment = () => {
    const startDate = form.getValues('startDate');
    const endDate = form.getValues('endDate');
    const schedule = form.getValues('schedulePayment');
    const isCustomSchedule = schedule === 'custom';
    
    const newPayment: CustomPayment = { 
      amount: '', 
      date: isCustomSchedule ? '' : generateNextPaymentDate(startDate, schedule, customPayments.length),
      description: isCustomSchedule ? '' : `Payment ${customPayments.length + 1}` 
    };
    
    // Calculate proper renewal limit: endDate or startDate + 1 year
    let renewalLimit: Date;
    if (endDate && endDate.trim() !== '') {
      renewalLimit = new Date(endDate);
    } else if (startDate) {
      renewalLimit = new Date(startDate);
      renewalLimit.setFullYear(renewalLimit.getFullYear() + 1);
    } else {
      renewalLimit = new Date();
      renewalLimit.setFullYear(renewalLimit.getFullYear() + 1);
    }
    
    const paymentDate = new Date(newPayment.date);
    
    // Check if we're exceeding the bill's renewal period
    if (!isCustomSchedule && newPayment.date && paymentDate >= renewalLimit) {
      const limitDesc = endDate && endDate.trim() !== '' 
        ? 'the bill\'s end date' 
        : 'the next renewal period (1 year from start date)';
      toast({
        title: 'Payment Limit Reached',
        description: `Cannot add more payments beyond ${limitDesc}. Payment schedules are limited to the bill's active period.`,
        variant: 'destructive',
      });
      return;
    }
    
    setCustomPayments([...customPayments, newPayment]);
  };

  const removeCustomPayment = (index: number) => {
    const updated = customPayments.filter((_, i) => i !== index);
    setCustomPayments(updated);
    form.setValue('customPayments', updated);
  };

  const updateCustomPayment = (index: number, field: keyof CustomPayment, value: string) => {
    const updated = customPayments.map((payment, i) => 
      i === index ? { ...payment, [field]: value } : payment
    );
    setCustomPayments(updated);
    form.setValue('customPayments', updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">
          {bill ? t('bills.editBill') : t('bills.createNewBill')}
        </h2>
        {aiExtractionData && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {t('bills.aiExtracted')}
          </Badge>
        )}
      </div>


      {!bill && (
        <Tabs defaultValue="manual" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" data-testid="tab-manual">
              <FileText className="w-4 h-4 mr-2" />
              {t('bills.manualEntry')}
            </TabsTrigger>
            {aiEnabled && (
              <TabsTrigger value="ai" data-testid="tab-ai">
                <Sparkles className="w-4 h-4 mr-2" />
                {t('bills.aiExtraction')}
              </TabsTrigger>
            )}
          </TabsList>

          {aiEnabled && (
            <TabsContent value="ai" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    {t('bills.uploadBillDocument')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SharedUploader
                    onDocumentChange={handleFileUpload}
                    formType="bills"
                    uploadContext={uploadContext}
                    aiAnalysisEnabled={aiEnabled}
                    onAiToggle={handleAiToggle}
                    onAiAnalysisComplete={handleAiAnalysisComplete}
                    showAiToggle={false}
                    allowedFileTypes={['image/*', 'application/pdf']}
                    maxFileSize={25}
                  />
                  
                  {isExtracting && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-blue-700 dark:text-blue-300 font-medium">
                          Extracting data from your document...
                        </span>
                      </div>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        This may take a few seconds depending on document complexity.
                      </p>
                    </div>
                  )}
                  
                  {aiFile && (
                    <GeminiBillExtractor
                      file={aiFile}
                      onExtractionComplete={handleAiExtractionComplete}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}


          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {t('bills.uploadDocumentOptional')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SharedUploader
                  onDocumentChange={handleFileUpload}
                  formType="bills"
                  uploadContext={uploadContext}
                  aiAnalysisEnabled={false} // Disabled in manual entry
                  showAiToggle={false} // Don't show toggle in manual entry
                  allowedFileTypes={['image/*', 'application/pdf']}
                  maxFileSize={25}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Bill Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Auto-save status indicator */}
          {(isAutoSaving || (autoSaveStatus && autoSaveStatus !== 'Draft')) && (
            <div className="flex items-center justify-center gap-2 p-2 text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              {isAutoSaving && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
              <span className={cn(
                "font-medium",
                autoSaveStatus === 'Saved' && "text-green-600 dark:text-green-400",
                autoSaveStatus === 'Save failed' && "text-red-600 dark:text-red-400",
                (isAutoSaving || autoSaveStatus === 'Saving...') && "text-blue-600 dark:text-blue-400",
                autoSaveStatus === 'Draft' && "text-gray-600 dark:text-gray-400"
              )}>
                {isAutoSaving ? t('bills.autoSaving') : autoSaveStatus}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bills.title')}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Monthly Electricity Bill" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vendor */}
            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bills.vendor')}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Hydro Quebec" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bills.category')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bills.status')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">{t('bills.statusDraft')}</SelectItem>
                      <SelectItem value="sent">{t('bills.statusSent')}</SelectItem>
                      <SelectItem value="overdue">{t('bills.statusOverdue')}</SelectItem>
                      <SelectItem value="paid">{t('bills.statusPaid')}</SelectItem>
                      <SelectItem value="cancelled">{t('bills.statusCancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {field.value === 'draft' && (
                    <FormDescription className="text-amber-600 dark:text-amber-400">
                      {t('bills.statusDraftNote')}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Count */}
            <FormField
              control={form.control}
              name="paymentCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bills.paymentCount')}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                      data-testid="radio-payment-count"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1" id="payment-count-1" data-testid="radio-payment-count-1" />
                        <Label htmlFor="payment-count-1" className="font-normal cursor-pointer">
                          {t('bills.paymentCountSingle')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="multiple" id="payment-count-multiple" data-testid="radio-payment-count-multiple" />
                        <Label htmlFor="payment-count-multiple" className="font-normal cursor-pointer">
                          {t('bills.paymentCountMultiple')}
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    {t('bills.paymentCountDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recurrence Checkbox - Only visible when paymentCount is 'multiple' */}
            {paymentCount === 'multiple' && (
              <FormField
                control={form.control}
                name="recurrence"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-recurrence"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal cursor-pointer">
                        {t('bills.recurrence')}
                      </FormLabel>
                      <FormDescription>
                        {t('bills.recurrenceDescription')}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* Payment Amount - Only for single payment */}
            {paymentCount === '1' && (
              <FormField
                control={form.control}
                name="singlePaymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bills.singlePaymentAmount')}</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" type="number" step="0.01" {...field} data-testid="input-payment-amount" />
                    </FormControl>
                    <FormDescription>
                      {t('bills.singlePaymentAmountDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Start Date */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bills.startDate')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Payment Configuration - Only shown for multiple payments */}
          {paymentCount === 'multiple' && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="schedulePayment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bills.paymentSchedule')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">{t('bills.scheduleWeekly')}</SelectItem>
                        <SelectItem value="monthly">{t('bills.scheduleMonthly')}</SelectItem>
                        <SelectItem value="quarterly">{t('bills.scheduleQuarterly')}</SelectItem>
                        <SelectItem value="yearly">{t('bills.scheduleYearly')}</SelectItem>
                        <SelectItem value="custom">{t('bills.scheduleCustom')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Smart Payment Configuration */}
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">{t('bills.paymentConfiguration')}</h4>
                
                {/* Initial Payment Question */}
                <FormField
                  control={form.control}
                  name="hasInitialPayment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{t('bills.initialPayment')}</FormLabel>
                        <FormDescription>
                          {t('bills.initialPaymentDescription')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Recurring Payments Equal Question */}
                <FormField
                  control={form.control}
                  name="recurringPaymentsEqual"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{t('bills.equalRecurringPayments')}</FormLabel>
                        <FormDescription>
                          {t('bills.equalRecurringPaymentsDescription')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Conditional Payment Amount Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Initial Payment Amount */}
                {hasInitialPayment && (
                  <FormField
                    control={form.control}
                    name="initialPaymentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('bills.initialPaymentAmount')}</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>
                          {t('bills.initialPaymentAmountDescription')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Recurring Payment Amount */}
                {recurringPaymentsEqual && (
                  <FormField
                    control={form.control}
                    name="recurringPaymentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('bills.recurringPaymentAmount')}</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>
                          {t('bills.recurringPaymentAmountDescription')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* End Date for Recurrent Bills */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bills.recurrenceEndDate')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        max={new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('bills.recurrenceEndDateDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(schedulePayment === 'custom' || !recurringPaymentsEqual) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{schedulePayment === 'custom' ? t('bills.customPaymentSchedule') : t('bills.individualPaymentAmounts')}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomPayment}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('bills.addPayment')}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {schedulePayment === 'custom' 
                        ? t('bills.customPaymentScheduleDescription')
                        : t('bills.individualPaymentAmountsDescription')}
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-3">
                      {customPayments.map((payment, index) => (
                        <div key={index} className="flex gap-2 items-end p-3 border rounded bg-white dark:bg-gray-800">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-400">{t('bills.amount')}</label>
                            <Input
                              placeholder="0.00"
                              type="number"
                              step="0.01"
                              value={payment.amount}
                              onChange={(e) => updateCustomPayment(index, 'amount', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          {schedulePayment === 'custom' && (
                            <div className="flex-1">
                              <label className="text-xs text-gray-500 dark:text-gray-400">{t('bills.date')}</label>
                              <Input
                                type="date"
                                value={payment.date}
                                onChange={(e) => updateCustomPayment(index, 'date', e.target.value)}
                                max={new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]}
                                className="mt-1"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-400">{t('bills.description')}</label>
                            <Input
                              placeholder={schedulePayment === 'custom' ? 'Payment description' : `Payment ${index + 1}`}
                              value={payment.description || ''}
                              onChange={(e) => updateCustomPayment(index, 'description', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCustomPayment(index)}
                            className="flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {customPayments.length === 0 && (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No payments added yet</p>
                        <p className="text-xs">Click "Add Payment" to get started</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('bills.description')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional details about this bill..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('bills.notes')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Internal notes..."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Display attached documents if editing existing bill */}
          {bill?.id && attachedDocuments.length > 0 && (
            <div className="space-y-4">
              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Attached Documents ({attachedDocuments.length})
                </h4>
                <div className="grid gap-3">
                  {attachedDocuments.map((document) => (
                    <AttachedFileSection
                      key={document.id}
                      entityType="document"
                      entityId={document.id}
                      filePath={document.filePath}
                      fileName={document.fileName || document.name}
                      fileSize={document.fileSize}
                      canView={true}
                      canDownload={true}
                      className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      fallbackName={document.name || 'Bill Attachment'}
                      data-testid={`attachment-${document.id}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Calculated Total Amount Display */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('bills.calculatedTotalAmount')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {paymentCount === '1' 
                      ? t('bills.totalAmountSingleDescription')
                      : paymentCount === 'multiple' && recurringPaymentsEqual 
                        ? t('bills.totalAmountMultipleEqualDescription')
                        : t('bills.totalAmountMultipleCustomDescription')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-calculated-total">
                    ${paymentCount === '1' 
                      ? parseFloat(form.watch('totalAmount') || '0').toFixed(2)
                      : calculatedTotal.toFixed(2)}
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    {paymentCount === 'multiple' ? t('bills.autoCalculatedBadge') : t('bills.fromPaymentAmountBadge')}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-between items-center">
            {/* Delete button on the left (only for existing bills) */}
            <div>
              {bill && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete} 
                  disabled={deleteBillMutation.isPending}
                >
                  {deleteBillMutation.isPending ? t('bills.deleting') : t('bills.deleteBill')}
                </Button>
              )}
            </div>
            
            {/* Cancel and Save/Update buttons on the right */}
            <div className="flex gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  {t('bills.cancel')}
                </Button>
              )}
              <Button type="submit" disabled={billMutation.isPending}>
                {billMutation.isPending ? t('bills.processing') : (bill ? t('bills.updateBill') : t('bills.createBill'))}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}