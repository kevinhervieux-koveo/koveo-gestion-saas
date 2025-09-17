import React, { useState, useEffect } from 'react';
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
import type { Bill, Document } from '@shared/schema';
import type { UploadContext } from '@shared/config/upload-config';

// Unified form schema with smart payment logic
const billFormSchema = z.object({
  title: z.string().min(1, 'Bill title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  category: z.enum([
    'insurance',
    'maintenance',
    'salary',
    'utilities',
    'cleaning',
    'security',
    'landscaping',
    'professional_services',
    'administration',
    'repairs',
    'supplies',
    'taxes',
    'technology',
    'reserves',
    'other',
  ]),
  vendor: z.string().max(150, 'Vendor name must be less than 150 characters').optional(),
  paymentType: z.enum(['unique', 'recurrent']),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  hasInitialPayment: z.boolean().optional(),
  recurringPaymentsEqual: z.boolean().optional(),
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
  if (data.paymentType === 'unique') {
    // For unique payments, total amount is required
    if (!data.totalAmount || data.totalAmount.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Total amount is required for unique payments',
        path: ['totalAmount']
      });
    }
  } else if (data.paymentType === 'recurrent') {
    // For recurring payments, validate based on configuration
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

const BILL_CATEGORIES = [
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'administration', label: 'Administration' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'technology', label: 'Technology' },
  { value: 'salary', label: 'Salary' },
  { value: 'reserves', label: 'Reserves' },
  { value: 'other', label: 'Other' },
];

export default function ModularBillForm({ bill, onSuccess, onCancel, buildingId }: ModularBillFormProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for AI extraction
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiExtractionData, setAiExtractionData] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true); // AI enabled by default for bills
  
  // State for manual document upload
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [customPayments, setCustomPayments] = useState<CustomPayment[]>([]);
  
  
  // Upload context for secure storage
  const uploadContext: UploadContext = {
    type: 'bills',
    organizationId: 'default', // Would be dynamic based on user's org
    buildingId,
    userRole: 'admin', // Would be dynamic based on user's role
    userId: 'current-user' // Would be dynamic based on current user
  };

  // Form setup
  const form = useForm<BillFormData>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      title: bill?.title || '',
      description: bill?.description || '',
      category: bill?.category || 'other',
      vendor: bill?.vendor || '',
      paymentType: bill?.paymentType || 'unique',
      schedulePayment: 'monthly',
      customPayments: [],
      hasInitialPayment: false,
      recurringPaymentsEqual: true,
      initialPaymentAmount: '',
      recurringPaymentAmount: '',
      totalAmount: bill?.totalAmount?.toString() || '',
      startDate: bill?.startDate || '',
      endDate: bill?.endDate || '',
      status: bill?.status || 'draft',
      notes: bill?.notes || '',
    }
  });

  const paymentType = form.watch('paymentType');
  const schedulePayment = form.watch('schedulePayment');
  const hasInitialPayment = form.watch('hasInitialPayment');
  const recurringPaymentsEqual = form.watch('recurringPaymentsEqual');


  // Query for attached documents when editing an existing bill
  const { data: attachedDocuments = [] } = useQuery<Document[]>({
    queryKey: ['/api/documents', { attachedToType: 'bill', attachedToId: bill?.id }],
    queryFn: async () => {
      if (!bill?.id) return [];
      
      console.log('[MODULAR BILL FORM] Fetching attached documents for bill:', bill.id);
      
      const response = await fetch(`/api/documents?attachedToType=bill&attachedToId=${bill.id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch attached documents');
      }
      
      const data = await response.json();
      console.log('[MODULAR BILL FORM] Attached documents received:', data);
      return Array.isArray(data.documents) ? data.documents : [];
    },
    enabled: !!bill?.id
  });


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
      if (aiEnabled) {
        setAiFile(file);
        setIsAiMode(true);
        setIsExtracting(true);
      } else {
        setManualFile(file);
      }
      // Clear text content when file is selected
      setTextContent(null);
    } else if (text) {
      // Handle text content input
      setTextContent(text);
      // Clear file content when text is entered
      setAiFile(null);
      setManualFile(null);
    } else {
      // Clear both when neither file nor text is provided
      setTextContent(null);
      setAiFile(null);
      setManualFile(null);
    }
  };

  // Create/Update bill mutation
  const billMutation = useMutation({
    mutationFn: async (data: BillFormData) => {
      const endpoint = bill ? `/api/bills/${bill.id}` : '/api/bills';
      const method = bill ? 'PUT' : 'POST';
      
      // Calculate costs array based on payment structure
      let costs: string[] = [];
      let calculatedTotalAmount = data.totalAmount;
      
      if (data.paymentType === 'unique') {
        costs = [data.totalAmount || '0'];
      } else if (data.paymentType === 'recurrent') {
        if (data.recurringPaymentsEqual) {
          // For equal recurring payments
          if (data.hasInitialPayment && data.initialPaymentAmount) {
            costs.push(data.initialPaymentAmount);
          }
          if (data.recurringPaymentAmount) {
            // Add at least one recurring payment, more will be generated by the system
            costs.push(data.recurringPaymentAmount);
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
      if (data.paymentType === 'recurrent' && !data.recurringPaymentsEqual && data.customPayments) {
        scheduleCustom = data.customPayments
          .map(p => p.date)
          .filter(d => d && d.trim() !== '');
      }
      
      const billData = {
        ...data,
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
      
      // Upload document or create text file if content was provided
      const fileToUpload = aiFile || manualFile;
      if (!bill && (fileToUpload || textContent)) {
        try {
          if (fileToUpload) {
            // Handle file upload
            console.log('[BILL FORM] Uploading document:', fileToUpload.name, 'for bill:', billResponse.id);
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
            console.log('[BILL FORM] Document upload successful:', uploadResult);
            
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
          } else if (textContent) {
            // Handle text content creation
            console.log('[BILL FORM] Creating text document for bill:', billResponse.id);
            const formData = new FormData();
            formData.append('textContent', textContent);
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
            console.log('[BILL FORM] Text document creation successful:', uploadResult);
            
            // Show success toast for text document creation
            toast({
              title: 'Text Document Created',
              description: 'Your text content has been saved as a document attached to the bill',
            });
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
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
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
          {bill ? 'Edit Bill' : 'Create New Bill'}
        </h2>
        {aiExtractionData && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI Extracted
          </Badge>
        )}
      </div>

      {!bill && (
        <Tabs defaultValue="manual" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" data-testid="tab-manual">
              <FileText className="w-4 h-4 mr-2" />
              Manual Entry
            </TabsTrigger>
            {aiEnabled && (
              <TabsTrigger value="ai" data-testid="tab-ai">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Extraction
              </TabsTrigger>
            )}
          </TabsList>

          {aiEnabled && (
            <TabsContent value="ai" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Upload Bill Document
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
                  Upload Document (Optional)
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
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
                  <FormLabel>Vendor</FormLabel>
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
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BILL_CATEGORIES.map((category) => (
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
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Type */}
            <FormField
              control={form.control}
              name="paymentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unique">One-time Payment</SelectItem>
                      <SelectItem value="recurrent">Recurring Payment</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Total Amount - Conditional based on payment type */}
            {paymentType === 'unique' ? (
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount *</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>
                      Complete amount for this one-time payment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>
                      Leave empty to calculate from individual payment amounts
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
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Recurring Payment Schedule */}
          {paymentType === 'recurrent' && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="schedulePayment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Schedule</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="custom">Custom Schedule</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Smart Payment Configuration */}
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Payment Configuration</h4>
                
                {/* Initial Payment Question */}
                <FormField
                  control={form.control}
                  name="hasInitialPayment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Initial Payment</FormLabel>
                        <FormDescription>
                          Is there an upfront payment different from recurring amounts?
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
                        <FormLabel className="text-base">Equal Recurring Payments</FormLabel>
                        <FormDescription>
                          Are all recurring payment amounts the same?
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
                        <FormLabel>Initial Payment Amount *</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>
                          Amount for the upfront payment
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
                        <FormLabel>Recurring Payment Amount *</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>
                          Amount for each recurring payment
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
                    <FormLabel>Recurrence End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        max={new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]}
                      />
                    </FormControl>
                    <FormDescription>
                      Payment schedule will be limited to the next year. Setting an end date will stop recurring bills after this date.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(schedulePayment === 'custom' || !recurringPaymentsEqual) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{schedulePayment === 'custom' ? 'Custom Payment Schedule' : 'Individual Payment Amounts'}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomPayment}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Payment
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {schedulePayment === 'custom' 
                        ? 'Define your custom payment schedule with specific dates and amounts.'
                        : 'Since recurring payments are not equal, specify individual amounts for each payment. Dates will be calculated based on your selected schedule.'}
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-3">
                      {customPayments.map((payment, index) => (
                        <div key={index} className="flex gap-2 items-end p-3 border rounded bg-white dark:bg-gray-800">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 dark:text-gray-400">Amount *</label>
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
                              <label className="text-xs text-gray-500 dark:text-gray-400">Date *</label>
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
                            <label className="text-xs text-gray-500 dark:text-gray-400">Description</label>
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
                <FormLabel>Description</FormLabel>
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
                <FormLabel>Notes</FormLabel>
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
                  {deleteBillMutation.isPending ? 'Deleting...' : 'Delete Bill'}
                </Button>
              )}
            </div>
            
            {/* Cancel and Save/Update buttons on the right */}
            <div className="flex gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={billMutation.isPending}>
                {billMutation.isPending ? 'Processing...' : (bill ? 'Update Bill' : 'Create Bill')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}