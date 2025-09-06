import React, { useState, useEffect, useCallback } from 'react';
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
import { FileText, Upload, Sparkles, Paperclip } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { Bill } from '@shared/schema';
import { FileUpload } from '@/components/ui/file-upload';
import { AttachedFileSection } from './AttachedFileSection';

// Unified form schema
const billFormSchema = z.object({
  title: z.string().min(1, 'Bill title is required (example: Monthly Electricity Bill)').max(200, 'Title must be less than 200 characters'),
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
  totalAmount: z.string().min(1, 'Amount is required and must be a valid number (example: 1250.50)').refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Amount must be between $0.01 and $999,999.99 (example: 1250.50)'),
  startDate: z.string().min(1, 'Start date is required (example: 2025-01-15)').refine((val) => {
    return !isNaN(Date.parse(val));
  }, 'Start date must be a valid date (example: 2025-01-15)'),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, 'End date must be a valid date (example: 2025-12-31)'),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
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
  dueDate?: string;
  billNumber?: string;
  vendorContact?: string;
  paymentType?: 'unique' | 'recurrent';
  isRecurrent?: boolean;
  confidence: number;
  fieldConfidences: {
    title: number;
    vendor: number;
    category: number;
    totalAmount: number;
    paymentType: number;
    dates: number;
  };
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
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('manual');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [aiAnalysisData, setAiAnalysisData] = useState<AiAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachmentMode, setAttachmentMode] = useState<'file' | 'text'>('file');
  const [attachmentText, setAttachmentText] = useState('');

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

      // Apply payment type if detected
      if (aiAnalysisData.paymentType) {
        form.setValue('paymentType', aiAnalysisData.paymentType);
      }

      // Apply notes with additional AI extracted information
      let notes = form.getValues('notes') || '';
      if (aiAnalysisData.billNumber) {
        notes += `\nBill Number: ${aiAnalysisData.billNumber}`;
      }
      if (aiAnalysisData.vendorContact) {
        notes += `\nVendor Contact: ${aiAnalysisData.vendorContact}`;
      }
      if (aiAnalysisData.dueDate) {
        notes += `\nDue Date: ${aiAnalysisData.dueDate}`;
      }
      notes += `\nAI Analysis Confidence: ${(aiAnalysisData.confidence * 100).toFixed(1)}%`;
      
      if (notes.trim()) {
        form.setValue('notes', notes.trim());
      }
    }
  };

  const onSubmit = (values: BillFormData) => {
    submitMutation.mutate(values);
    // TODO: Handle attached files upload after bill creation
  };

  // Handle file attachments
  const handleFilesSelect = useCallback((files: File[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  }, []);

  const handleFileRemove = useCallback((fileIndex: number) => {
    setAttachedFiles(prev => prev.filter((_, index) => index !== fileIndex));
  }, []);

  const renderFormFields = () => (
    <>
      <div className='grid grid-cols-2 gap-4'>
        {/* Title */}
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('title')} *</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('billTitle')} data-testid='input-title' />
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
              <FormLabel>{t('vendor')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('companyOrServiceProvider')}
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
              <FormLabel>{t('category')} *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid='select-category'>
                    <SelectValue placeholder={t('selectCategory')} />
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

      {/* Choose Document Type - Unified Component */}
      <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900">Choose Document Type</h3>
        
        {/* Document Type Selection */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAttachmentMode('file')}
            className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
              attachmentMode === 'file'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            data-testid="button-file-mode"
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setAttachmentMode('text')}
            className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
              attachmentMode === 'text'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            data-testid="button-text-mode"
          >
            Text Document
          </button>
        </div>

        {/* Dynamic Content Based on Selection */}
        {attachmentMode === 'file' ? (
          <div>
            <label className="text-sm font-medium text-gray-700">Select File to Upload</label>
            <FileUpload
              onFilesSelect={handleFilesSelect}
              onFilesRemove={handleFileRemove}
              maxFiles={5}
              maxSize={10}
              acceptedTypes={['image/*', '.pdf', '.doc', '.docx', '.txt']}
              allowPaste={true}
              className="border border-gray-200 rounded-lg p-4 mt-1"
              data-testid="bill-file-upload"
            >
              <div className="text-center py-6">
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  Drop files here, click to browse, or paste screenshots
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Attach receipts, screenshots, or supporting documents
                </p>
              </div>
            </FileUpload>
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium text-gray-700">Document Content</label>
            <textarea
              value={attachmentText}
              onChange={(e) => setAttachmentText(e.target.value)}
              rows={4}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter text notes or details about this bill..."
              data-testid="textarea-text-content"
            />
            <p className="text-sm text-gray-500 mt-1">
              Add text notes or details that will be saved with the bill.
            </p>
          </div>
        )}
      </div>
    </>
  );

  // For edit mode, render simple form
  if (mode === 'edit') {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6 pt-4 border-t'>
          {renderFormFields()}

          {/* Show existing attached file if present */}
          {bill?.documentPath && (
            <div className='space-y-3'>
              <Label className='text-sm font-medium text-gray-900'>Attached Document</Label>
              <AttachedFileSection
                entityType='bill'
                entityId={bill.id}
                filePath={bill.documentPath}
                fileName={bill.documentName}
                canView={true}
                canDownload={true}
                className='bg-gray-50 rounded-lg'
              />
            </div>
          )}

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
          <TabsTrigger value='manual' data-testid='tab-manual'>
            Create Manually
          </TabsTrigger>
          <TabsTrigger value='upload' data-testid='tab-upload'>
            Upload & Analyze
          </TabsTrigger>
        </TabsList>

        <TabsContent value='upload' className='space-y-4'>
          <div className='p-6 text-center border-2 border-dashed border-gray-200 rounded-lg'>
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
                <div className='flex items-center gap-2 mb-3'>
                  <span className='font-medium text-blue-800'>AI Analysis Complete</span>
                  <Badge variant='outline' className='text-xs'>
                    {(aiAnalysisData.confidence * 100).toFixed(1)}% overall confidence
                  </Badge>
                </div>
                
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-sm'>
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span className='text-blue-700'><strong>Title:</strong> {aiAnalysisData.title}</span>
                      {aiAnalysisData.fieldConfidences && (
                        <Badge variant='outline' className='text-xs'>
                          {(aiAnalysisData.fieldConfidences.title * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    
                    {aiAnalysisData.vendor && (
                      <div className='flex justify-between'>
                        <span className='text-blue-700'><strong>Vendor:</strong> {aiAnalysisData.vendor}</span>
                        {aiAnalysisData.fieldConfidences && (
                          <Badge variant='outline' className='text-xs'>
                            {(aiAnalysisData.fieldConfidences.vendor * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className='flex justify-between'>
                      <span className='text-blue-700'><strong>Amount:</strong> ${aiAnalysisData.totalAmount}</span>
                      {aiAnalysisData.fieldConfidences && (
                        <Badge variant='outline' className='text-xs'>
                          {(aiAnalysisData.fieldConfidences.totalAmount * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span className='text-blue-700'><strong>Category:</strong> {aiAnalysisData.category}</span>
                      {aiAnalysisData.fieldConfidences && (
                        <Badge variant='outline' className='text-xs'>
                          {(aiAnalysisData.fieldConfidences.category * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    
                    {aiAnalysisData.paymentType && (
                      <div className='flex justify-between'>
                        <span className='text-blue-700'><strong>Type:</strong> {aiAnalysisData.paymentType === 'recurrent' ? 'Recurring' : 'One-time'}</span>
                        {aiAnalysisData.fieldConfidences && (
                          <Badge variant='outline' className='text-xs'>
                            {(aiAnalysisData.fieldConfidences.paymentType * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {(aiAnalysisData.issueDate || aiAnalysisData.dueDate) && (
                      <div className='flex justify-between'>
                        <span className='text-blue-700'><strong>Dates:</strong> {aiAnalysisData.issueDate || aiAnalysisData.dueDate}</span>
                        {aiAnalysisData.fieldConfidences && (
                          <Badge variant='outline' className='text-xs'>
                            {(aiAnalysisData.fieldConfidences.dates * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {(aiAnalysisData.billNumber || aiAnalysisData.vendorContact) && (
                  <div className='mt-3 pt-3 border-t border-blue-200 text-xs text-blue-600'>
                    {aiAnalysisData.billNumber && <p><strong>Bill Number:</strong> {aiAnalysisData.billNumber}</p>}
                    {aiAnalysisData.vendorContact && <p><strong>Vendor Contact:</strong> {aiAnalysisData.vendorContact}</p>}
                  </div>
                )}
                
                <Button
                  onClick={applyAiAnalysis}
                  className='mt-3 w-full'
                  size='sm'
                  data-testid='button-apply-ai'
                >
                  Apply All Fields to Form
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
