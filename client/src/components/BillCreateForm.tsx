/// <reference types='../../../types/browser-apis' />
import React, { useState } from 'react';
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

// Type for AI analysis result
/**
 * AI analysis result interface for bill document processing.
 */
interface AiAnalysisResult {
  title: string;
  vendor?: string;
  category: 'insurance' | 'maintenance' | 'salary' | 'utilities' | 'cleaning' | 'security' | 'landscaping' | 'professional_services' | 'administration' | 'repairs' | 'supplies' | 'taxes' | 'technology' | 'reserves' | 'other';
  totalAmount: string;
  description?: string;
  issueDate?: string;
  billNumber?: string;
  confidence: number;
}

// Form schema for bill creation
const billCreateSchema = z.object({
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
    'other'
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
 * Bill creation form with manual entry and AI document analysis.
 * @param props - Component props.
 * @param props.buildingId - The ID of the building to create the bill for.
 * @param props.onSuccess - Callback function called when bill is successfully created.
 * @returns JSX element for bill creation form.
 */
export function BillCreateForm({ 
  buildingId, 
  onSuccess 
}: { 
  buildingId: string; 
  onSuccess: () => void; 
}) {
  const [activeTab, setActiveTab] = useState('manual');
  const [_uploadedFile, setUploadedFile] = useState<globalThis.File | null>(null);
  const [aiAnalysisData, setAiAnalysisData] = useState<AiAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const form = useForm<z.infer<typeof billCreateSchema>>({
    resolver: zodResolver(billCreateSchema),
    defaultValues: {
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
    }
  });

  const queryClient = useQueryClient();

  const createBillMutation = useMutation({
    mutationFn: async (billData: z.infer<typeof billCreateSchema>) => {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          buildingId,
          ...billData,
          costs: [parseFloat(billData.totalAmount)]
        })
      });


      
      if (!response.ok) {
        throw new Error('Failed to create bill');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
      onSuccess();
    }
  });

  const uploadAndAnalyzeMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
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
          notes: 'Draft bill created for AI analysis'
        })
      });


      
      if (!createResponse.ok) {
        throw new Error('Failed to create draft bill');
      }
      
      const draftBill = await createResponse.json();
      
      // Upload and analyze the document
      const formData = new globalThis.FormData();
      formData.append('document', file);
      
      const uploadResponse = await fetch(`/api/bills/${draftBill.bill.id}/upload-document`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });


      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload and analyze document');
      }
      
      const result = await uploadResponse.json();
      return { ...result, billId: draftBill.bill.id };
    },
    onSuccess: (_data) => {
      setIsAnalyzing(false);
      setAiAnalysisData(_data.analysisResult);
      setActiveTab('manual'); // Switch to manual tab to show populated form
    },
    onError: () => {
      setIsAnalyzing(false);
    }
  });

  const handleFileUpload = (_event: React.ChangeEvent<HTMLInputElement>) => {
    const file = _event.target.files?.[0]; /**
   * If function.
   * @param file - File parameter.
   */ /**
   * If function.
   * @param file - File parameter.
   */


    if (file) {
      setUploadedFile(file);
      uploadAndAnalyzeMutation.mutate(file);
    }
  };

  const applyAiAnalysis = () => { /**
   * If function.
   * @param aiAnalysisData - AiAnalysisData parameter.
   */ /**
   * If function.
   * @param aiAnalysisData - AiAnalysisData parameter.
   */


    if (aiAnalysisData) {
      form.setValue('title', aiAnalysisData.title);
      form.setValue('vendor', aiAnalysisData.vendor || '');
      form.setValue('category', aiAnalysisData.category);
      form.setValue('totalAmount', aiAnalysisData.totalAmount);
      form.setValue('description', aiAnalysisData.description || ''); /**
   * If function.
   * @param aiAnalysisData.issueDate - AiAnalysisData.issueDate parameter.
   */ /**
   * If function.
   * @param aiAnalysisData.issueDate - AiAnalysisData.issueDate parameter.
   */


      
      if (aiAnalysisData.issueDate) {
        form.setValue('startDate', aiAnalysisData.issueDate);
      }
      
      const notes = `AI-analyzed document. Original bill number: ${aiAnalysisData.billNumber || 'N/A'}. Confidence: ${(aiAnalysisData.confidence * 100).toFixed(1)}%.`;
      form.setValue('notes', notes);
    }
  };

  const onSubmit = (values: z.infer<typeof billCreateSchema>) => {
    createBillMutation.mutate(values);
  };

  return (
    <div className='space-y-6'>
      <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='manual' className='flex items-center gap-2'>
            <FileText className='w-4 h-4' />
            Create Manually
          </TabsTrigger>
          <TabsTrigger value='upload' className='flex items-center gap-2'>
            <Upload className='w-4 h-4' />
            Upload & Analyze
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value='upload' className='space-y-4'>
          <div className='p-6 text-center border-2 border-dashed border-gray-200 rounded-lg'>
            <Upload className='w-12 h-12 mx-auto text-gray-400 mb-4' />
            <h3 className='text-lg font-semibold mb-2'>Upload Bill Document</h3>
            <p className='text-gray-600 mb-4'>Upload an image or PDF of your bill for AI analysis</p>
            
            <Input
              type='file'
              accept='image/*,.pdf'
              onChange={handleFileUpload}
              disabled={isAnalyzing}
              className='max-w-sm mx-auto'
            />
            
            {isAnalyzing && (
              <div className='mt-4 flex items-center justify-center gap-2'>
                <div className='animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full'></div>
                <span className='text-sm text-gray-600'>Analyzing document with AI...</span>
              </div>
            )}
            
            {aiAnalysisData && (
              <div className='mt-4 p-4 bg-blue-50 rounded-lg'>
                <div className='flex items-center gap-2 mb-2'>
                  <Sparkles className='w-5 h-5 text-blue-600' />
                  <span className='font-medium text-blue-800'>AI Analysis Complete</span>
                  <Badge variant='outline' className='text-xs'>
                    {(aiAnalysisData.confidence * 100).toFixed(1)}% confidence
                  </Badge>
                </div>
                <div className='text-sm text-blue-700 space-y-1'>
                  <p><strong>Title:</strong> {aiAnalysisData.title}</p>
                  <p><strong>Vendor:</strong> {aiAnalysisData.vendor}</p>
                  <p><strong>Amount:</strong> ${aiAnalysisData.totalAmount}</p>
                  <p><strong>Category:</strong> {aiAnalysisData.category}</p>
                </div>
                <Button 
                  onClick={applyAiAnalysis}
                  className='mt-3 w-full'
                  size='sm'
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
              <div className='grid grid-cols-2 gap-4'>
                {/* Title */}
                <FormField
                  control={form.control}
                  name='title'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='Bill title' />
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
                        <Input {...field} placeholder='Company or service provider' />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select category' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='insurance'>Insurance</SelectItem>
                          <SelectItem value='maintenance'>Maintenance</SelectItem>
                          <SelectItem value='salary'>Salary</SelectItem>
                          <SelectItem value='utilities'>Utilities</SelectItem>
                          <SelectItem value='cleaning'>Cleaning</SelectItem>
                          <SelectItem value='security'>Security</SelectItem>
                          <SelectItem value='landscaping'>Landscaping</SelectItem>
                          <SelectItem value='professional_services'>Professional Services</SelectItem>
                          <SelectItem value='administration'>Administration</SelectItem>
                          <SelectItem value='repairs'>Repairs</SelectItem>
                          <SelectItem value='supplies'>Supplies</SelectItem>
                          <SelectItem value='taxes'>Taxes</SelectItem>
                          <SelectItem value='technology'>Technology</SelectItem>
                          <SelectItem value='reserves'>Reserves</SelectItem>
                          <SelectItem value='other'>Other</SelectItem>
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
                        <Input {...field} type='number' step='0.01' placeholder='0.00' />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select payment type' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='unique'>One-time Payment</SelectItem>
                          <SelectItem value='recurrent'>Recurring Payment</SelectItem>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Select schedule' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='weekly'>Weekly</SelectItem>
                            <SelectItem value='monthly'>Monthly</SelectItem>
                            <SelectItem value='quarterly'>Quarterly</SelectItem>
                            <SelectItem value='yearly'>Yearly</SelectItem>
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
                        <Input {...field} type='date' />
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
                          <Input {...field} type='date' />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select status' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='draft'>Draft</SelectItem>
                          <SelectItem value='sent'>Sent</SelectItem>
                          <SelectItem value='overdue'>Overdue</SelectItem>
                          <SelectItem value='paid'>Paid</SelectItem>
                          <SelectItem value='cancelled'>Cancelled</SelectItem>
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
                      <Textarea {...field} placeholder='Bill description...' rows={3} />
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
                      <Textarea {...field} placeholder='Additional notes...' rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* AI Analysis Info */}
              {aiAnalysisData && (
                <div className='p-4 bg-blue-50 rounded-lg border border-blue-200'>
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
                  disabled={createBillMutation.isPending}
                  className='min-w-[120px]'
                >
                  {createBillMutation.isPending ? 'Creating...' : 'Create Bill'}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}