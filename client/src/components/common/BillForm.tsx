/// <reference types='../../../types/browser-apis' />
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Upload, Sparkles } from 'lucide-react';
import type { Bill } from '../../../shared/schema';

// Unified form schema
const billFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
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
  vendor: z.string().optional(),
  paymentType: z.enum(['unique', 'recurrent']),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  totalAmount: z.string().min(1, 'Amount is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  notes: z.string().optional(),
});

/**
 *
 */
type BillFormData = z.infer<typeof billFormSchema>;

// AI analysis result interface
/**
 *
 */
interface AiAnalysisResult {
  title: string;
  vendor?: string;
  category: BillFormData['category'];
  totalAmount: string;
  description?: string;
  issueDate?: string;
  billNumber?: string;
  confidence: number;
}

// Component props interface
/**
 *
 */
interface BillFormProps {
  mode: 'create' | 'edit';
  buildingId: string;
  bill?: Bill; // Required for edit mode
  onSuccess: () => void;
  onCancel?: () => void; // Optional for create mode
}

// Bill category options - centralized list
export const BILL_CATEGORIES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'salary', label: 'Salary' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'administration', label: 'Administration' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'technology', label: 'Technology' },
  { value: 'reserves', label: 'Reserves' },
  { value: 'other', label: 'Other' },
] as const;

// Payment type options
export const PAYMENT_TYPES = [
  { value: 'unique', label: 'One-time Payment' },
  { value: 'recurrent', label: 'Recurring Payment' },
] as const;

// Schedule options
export const SCHEDULE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

// Status options
export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

/**
 * Unified bill form component for creating and editing bills.
 * Supports both manual entry and AI document analysis for creation.
 * @param root0
 * @param root0.mode
 * @param root0.buildingId
 * @param root0.bill
 * @param root0.onSuccess
 * @param root0.onCancel
 */
export function BillForm({ mode, buildingId, bill, onSuccess, onCancel }: BillFormProps) {
  const [activeTab, setActiveTab] = useState('manual');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [aiAnalysisData, setAiAnalysisData] = useState<AiAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const queryClient = useQueryClient();

  // Form setup with default values based on mode
  const getDefaultValues = (): BillFormData => {
    if (mode === 'edit' && bill) {
      return {
        title: bill.title,
        description: bill.description || '',
        category: bill.category,
        vendor: bill.vendor || '',
        paymentType: bill.paymentType,
        schedulePayment: bill.schedulePayment || 'monthly',
        totalAmount: bill.totalAmount.toString(),
        startDate: bill.startDate,
        endDate: bill.endDate || '',
        status: bill.status,
        notes: bill.notes || '',
      };
    }

    // Default values for create mode
    return {
      title: '',
      description: '',
      category: 'other',
      vendor: '',
      paymentType: 'unique',
      schedulePayment: 'monthly',
      totalAmount: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      status: 'draft',
      notes: '',
    };
  };

  const form = useForm<BillFormData>({
    resolver: zodResolver(billFormSchema),
    defaultValues: getDefaultValues(),
  });

  // Update form when bill changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && bill) {
      form.reset(getDefaultValues());
    }
  }, [mode, bill]);

  // Main mutation for create/update
  const submitMutation = useMutation({
    mutationFn: async (billData: BillFormData) => {
      const url = mode === 'create' ? '/api/bills' : `/api/bills/${bill?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const payload = {
        ...billData,
        costs: [parseFloat(billData.totalAmount)],
        ...(mode === 'create' && { buildingId }),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${mode} bill`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
      onSuccess();
    },
  });

  // AI analysis mutation (only for create mode)
  const uploadAndAnalyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsAnalyzing(true);

      // First create a draft bill
      const createResponse = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          buildingId,
          title: 'AI Analysis Draft',
          category: 'other',
          paymentType: 'unique',
          totalAmount: 0,
          costs: [0],
          startDate: new Date().toISOString().split('T')[0],
          status: 'draft',
          notes: 'Draft bill created for AI analysis',
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create draft bill');
      }

      const draftBill = await createResponse.json();

      // Upload and analyze the document
      const formData = new FormData();
      formData.append('document', file);

      const uploadResponse = await fetch(`/api/bills/${draftBill.bill.id}/upload-document`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload and analyze document');
      }

      const result = await uploadResponse.json();
      return { ...result, billId: draftBill.bill.id };
    },
    onSuccess: (data) => {
      setIsAnalyzing(false);
      setAiAnalysisData(data.analysisResult);
      setActiveTab('manual'); // Switch to manual tab to show populated form
    },
    onError: () => {
      setIsAnalyzing(false);
    },
  });

  // Event handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && mode === 'create') {
      setUploadedFile(file);
      uploadAndAnalyzeMutation.mutate(file);
    }
  };

  const applyAiAnalysis = () => {
    if (aiAnalysisData) {
      form.setValue('title', aiAnalysisData.title);
      form.setValue('vendor', aiAnalysisData.vendor || '');
      form.setValue('category', aiAnalysisData.category);
      form.setValue('totalAmount', aiAnalysisData.totalAmount);
      form.setValue('description', aiAnalysisData.description || '');

      if (aiAnalysisData.issueDate) {
        form.setValue('startDate', aiAnalysisData.issueDate);
      }

      const notes = `AI-analyzed document. Original bill number: ${aiAnalysisData.billNumber || 'N/A'}. Confidence: ${(aiAnalysisData.confidence * 100).toFixed(1)}%.`;
      form.setValue('notes', notes);
    }
  };

  const onSubmit = (values: BillFormData) => {
    submitMutation.mutate(values);
  };

  const renderFormFields = () => (
    <>
      <div className='grid grid-cols-2 gap-4'>
        {/* Title */}
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input {...field} placeholder='Bill title' data-testid='input-title' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Vendor */}
        <FormField
          control={form.control}
          name='vendor'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder='Company or service provider'
                  data-testid='input-vendor'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category */}
        <FormField
          control={form.control}
          name='category'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid='select-category'>
                    <SelectValue placeholder='Select category' />
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

        {/* Total Amount */}
        <FormField
          control={form.control}
          name='totalAmount'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Amount *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type='number'
                  step='0.01'
                  placeholder='0.00'
                  data-testid='input-amount'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Payment Type */}
        <FormField
          control={form.control}
          name='paymentType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid='select-payment-type'>
                    <SelectValue placeholder='Select payment type' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PAYMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Schedule Payment (only for recurrent) */}
        {form.watch('paymentType') === 'recurrent' && (
          <FormField
            control={form.control}
            name='schedulePayment'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Schedule *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid='select-schedule'>
                      <SelectValue placeholder='Select schedule' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Start Date */}
        <FormField
          control={form.control}
          name='startDate'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date *</FormLabel>
              <FormControl>
                <Input {...field} type='date' data-testid='input-start-date' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* End Date (only for recurrent) */}
        {form.watch('paymentType') === 'recurrent' && (
          <FormField
            control={form.control}
            name='endDate'
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} type='date' data-testid='input-end-date' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Status */}
        <FormField
          control={form.control}
          name='status'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid='select-status'>
                    <SelectValue placeholder='Select status' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Description */}
      <FormField
        control={form.control}
        name='description'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder='Bill description...'
                rows={3}
                data-testid='textarea-description'
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Notes */}
      <FormField
        control={form.control}
        name='notes'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder='Additional notes...'
                rows={3}
                data-testid='textarea-notes'
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );

  // For edit mode, render simple form
  if (mode === 'edit') {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6 pt-4 border-t'>
          {renderFormFields()}

          {/* Form Actions */}
          <div className='flex justify-end gap-2 pt-4 border-t'>
            {onCancel && (
              <Button
                type='button'
                variant='outline'
                onClick={onCancel}
                data-testid='button-cancel'
              >
                Cancel
              </Button>
            )}
            <Button type='submit' disabled={submitMutation.isPending} data-testid='button-update'>
              {submitMutation.isPending ? 'Updating...' : 'Update Bill'}
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  // For create mode, render with tabs (manual + AI upload)
  return (
    <div className='space-y-6'>
      <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='manual' className='flex items-center gap-2' data-testid='tab-manual'>
            <FileText className='w-4 h-4' />
            Create Manually
          </TabsTrigger>
          <TabsTrigger value='upload' className='flex items-center gap-2' data-testid='tab-upload'>
            <Upload className='w-4 h-4' />
            Upload & Analyze
          </TabsTrigger>
        </TabsList>

        <TabsContent value='upload' className='space-y-4'>
          <div className='p-6 text-center border-2 border-dashed border-gray-200 rounded-lg'>
            <Upload className='w-12 h-12 mx-auto text-gray-400 mb-4' />
            <h3 className='text-lg font-semibold mb-2'>Upload Bill Document</h3>
            <p className='text-gray-600 mb-4'>
              Upload an image or PDF of your bill for AI analysis
            </p>

            <Input
              type='file'
              accept='image/*,.pdf'
              onChange={handleFileUpload}
              disabled={isAnalyzing}
              className='max-w-sm mx-auto'
              data-testid='input-file-upload'
            />

            {isAnalyzing && (
              <div
                className='mt-4 flex items-center justify-center gap-2'
                data-testid='loading-analysis'
              >
                <div className='animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full'></div>
                <span className='text-sm text-gray-600'>Analyzing document with AI...</span>
              </div>
            )}

            {aiAnalysisData && (
              <div className='mt-4 p-4 bg-blue-50 rounded-lg' data-testid='ai-analysis-result'>
                <div className='flex items-center gap-2 mb-2'>
                  <Sparkles className='w-5 h-5 text-blue-600' />
                  <span className='font-medium text-blue-800'>AI Analysis Complete</span>
                  <Badge variant='outline' className='text-xs'>
                    {(aiAnalysisData.confidence * 100).toFixed(1)}% confidence
                  </Badge>
                </div>
                <div className='text-sm text-blue-700 space-y-1'>
                  <p>
                    <strong>Title:</strong> {aiAnalysisData.title}
                  </p>
                  <p>
                    <strong>Vendor:</strong> {aiAnalysisData.vendor}
                  </p>
                  <p>
                    <strong>Amount:</strong> ${aiAnalysisData.totalAmount}
                  </p>
                  <p>
                    <strong>Category:</strong> {aiAnalysisData.category}
                  </p>
                </div>
                <Button
                  onClick={applyAiAnalysis}
                  className='mt-3 w-full'
                  size='sm'
                  data-testid='button-apply-ai'
                >
                  Apply to Form
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value='manual' className='space-y-4'>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              {renderFormFields()}

              {/* AI Analysis Info */}
              {aiAnalysisData && (
                <div
                  className='p-4 bg-blue-50 rounded-lg border border-blue-200'
                  data-testid='ai-info-badge'
                >
                  <div className='flex items-center gap-2 mb-2'>
                    <Sparkles className='w-4 h-4 text-blue-600' />
                    <span className='text-sm font-medium text-blue-800'>
                      Form populated from AI analysis
                    </span>
                    <Badge variant='outline' className='text-xs'>
                      {(aiAnalysisData.confidence * 100).toFixed(1)}% confidence
                    </Badge>
                  </div>
                  <p className='text-xs text-blue-600'>
                    Review and modify the form as needed before creating the bill.
                  </p>
                </div>
              )}

              {/* Form Actions */}
              <div className='flex justify-end gap-2 pt-4 border-t'>
                <Button
                  type='submit'
                  disabled={submitMutation.isPending}
                  className='min-w-[120px]'
                  data-testid='button-create'
                >
                  {submitMutation.isPending ? 'Creating...' : 'Create Bill'}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BillForm;
