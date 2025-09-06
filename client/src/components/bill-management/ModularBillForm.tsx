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
import { SharedUploader } from '@/components/document-management';
import { GeminiBillExtractor } from './GeminiBillExtractor';
import type { Bill } from '@shared/schema';

// Unified form schema (simplified from original)
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
  totalAmount: z.string().min(1, 'Amount is required and must be a valid number').refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Amount must be between $0.01 and $999,999.99'),
  startDate: z.string().min(1, 'Start date is required').refine((val) => {
    return !isNaN(Date.parse(val));
  }, 'Start date must be a valid date'),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, 'End date must be a valid date'),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
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
  
  // State for manual document upload
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [customPayments, setCustomPayments] = useState<CustomPayment[]>([]);

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
      totalAmount: bill?.totalAmount?.toString() || '',
      startDate: bill?.startDate || '',
      endDate: bill?.endDate || '',
      status: bill?.status || 'draft',
      notes: bill?.notes || '',
    }
  });

  const paymentType = form.watch('paymentType');
  const schedulePayment = form.watch('schedulePayment');

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

  // Handle file upload from SharedUploader
  const handleFileUpload = (file: File, extractedText?: string) => {
    setAiFile(file);
    setIsAiMode(true);
  };

  // Create/Update bill mutation
  const billMutation = useMutation({
    mutationFn: async (data: BillFormData) => {
      const endpoint = bill ? `/api/bills/${bill.id}` : '/api/bills';
      const method = bill ? 'PUT' : 'POST';
      
      const billData = {
        ...data,
        buildingId: buildingId || bill?.buildingId,
        costs: [data.totalAmount], // Convert single amount to costs array
      };

      const response = await apiRequest(method, endpoint, billData);
      const billResponse = await response.json();
      
      // Upload document if one was attached (either from AI extraction or manual entry)
      const fileToUpload = aiFile || manualFile;
      if (!bill && fileToUpload) {
        try {
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
            billResponse.documentPath = uploadResult.bill.documentPath;
            billResponse.documentName = uploadResult.bill.documentName;
            billResponse.isAiAnalyzed = uploadResult.bill.isAiAnalyzed;
            billResponse.aiAnalysisData = uploadResult.bill.aiAnalysisData;
          }
          
          // Show success toast for document upload
          toast({
            title: 'Document Uploaded',
            description: `${fileToUpload.name} has been attached to the bill`,
          });
        } catch (uploadError) {
          console.error('[BILL FORM] Failed to upload document:', uploadError);
          toast({
            title: 'Document Upload Failed',
            description: `Failed to upload ${fileToUpload.name}. The bill was created but without the document.`,
            variant: 'destructive',
          });
          // Don't fail the bill creation if document upload fails
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

  // Custom Payment Management
  const addCustomPayment = () => {
    const newPayment: CustomPayment = { amount: '', date: '', description: '' };
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
            <TabsTrigger value="ai" data-testid="tab-ai">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Extraction
            </TabsTrigger>
          </TabsList>

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
                  allowedFileTypes={['image/*', 'application/pdf']}
                  maxFileSize={25}
                  showCamera={true}
                  compact={false}
                  placeholder="Upload a bill or receipt for AI extraction"
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
                  onDocumentChange={(file) => {
                    console.log('[MANUAL ENTRY] Document uploaded:', file.name);
                    setManualFile(file);
                    toast({
                      title: 'Document Uploaded',
                      description: `${file.name} attached to this bill entry`,
                    });
                  }}
                  allowedFileTypes={['image/*', 'application/pdf']}
                  maxFileSize={25}
                  showCamera={true}
                  compact={false}
                  placeholder="Upload bill receipt or invoice (optional)"
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

            {/* Total Amount */}
            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Amount *</FormLabel>
                  <FormControl>
                    <Input placeholder="0.00" type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

              {schedulePayment === 'custom' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Custom Payment Schedule</span>
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
                    {customPayments.map((payment, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input
                            placeholder="Amount"
                            type="number"
                            step="0.01"
                            value={payment.amount}
                            onChange={(e) => updateCustomPayment(index, 'amount', e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            type="date"
                            value={payment.date}
                            onChange={(e) => updateCustomPayment(index, 'date', e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            placeholder="Description"
                            value={payment.description || ''}
                            onChange={(e) => updateCustomPayment(index, 'description', e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeCustomPayment(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
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