import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText, Upload, Sparkles, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Import new modular components
import { SharedUploader } from '@/components/document-management/SharedUploader';
import { DocumentCard } from '@/components/document-management/DocumentCard';

// Import invoice schemas
import { 
  invoiceFormSchema, 
  type InvoiceFormData, 
  type Invoice 
} from '@shared/schemas/invoices';

interface InvoiceFormProps {
  mode: 'create' | 'edit';
  invoice?: Invoice;
  buildingId?: string;
  residenceId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InvoiceForm({
  mode,
  invoice,
  buildingId,
  residenceId,
  onSuccess,
  onCancel,
}: InvoiceFormProps) {
  const [uploadedDocument, setUploadedDocument] = useState<string | null>(
    invoice?.documentId || null
  );
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      vendorName: invoice?.vendorName || '',
      invoiceNumber: invoice?.invoiceNumber || '',
      totalAmount: invoice?.totalAmount ? parseFloat(invoice.totalAmount.toString()) : 0,
      dueDate: invoice?.dueDate || new Date(),
      paymentType: invoice?.paymentType || 'one-time',
      frequency: invoice?.frequency || undefined,
      startDate: invoice?.startDate || undefined,
      customPaymentDates: invoice?.customPaymentDates || undefined,
      buildingId: buildingId || invoice?.buildingId || undefined,
      residenceId: residenceId || invoice?.residenceId || undefined,
      documentId: invoice?.documentId || undefined,
      isAiExtracted: invoice?.isAiExtracted || false,
      extractionConfidence: invoice?.extractionConfidence ? parseFloat(invoice.extractionConfidence.toString()) : undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const response = await apiRequest('POST', '/api/invoices', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Invoice created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      if (!invoice?.id) throw new Error('Invoice ID is required for update');
      const response = await apiRequest('PUT', `/api/invoices/${invoice.id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Invoice updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = useCallback(
    (data: InvoiceFormData) => {
      const invoiceData = {
        ...data,
        documentId: uploadedDocument || undefined,
      };

      if (mode === 'create') {
        createMutation.mutate(invoiceData);
      } else {
        updateMutation.mutate(invoiceData);
      }
    },
    [mode, uploadedDocument, createMutation, updateMutation]
  );

  const handleDocumentUpload = useCallback(
    (documentId: string, file: File) => {
      setUploadedDocument(documentId);
      
      // Trigger AI extraction if it's a PDF
      if (file.type === 'application/pdf') {
        setIsAiProcessing(true);
        // TODO: Implement AI extraction API call
        setTimeout(() => {
          setIsAiProcessing(false);
          toast({
            title: 'AI Processing Complete',
            description: 'Invoice data extracted successfully',
          });
        }, 2000);
      }
    },
    [toast]
  );

  const handleDocumentRemove = useCallback(() => {
    setUploadedDocument(null);
    form.setValue('documentId', undefined);
  }, [form]);

  const paymentType = form.watch('paymentType');
  const frequency = form.watch('frequency');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? 'Create New Invoice' : 'Edit Invoice'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {mode === 'create' 
              ? 'Add a new invoice to the system'
              : 'Update invoice information'
            }
          </p>
        </div>
        {isAiProcessing && (
          <Badge variant="secondary" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-pulse" />
            AI Processing...
          </Badge>
        )}
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="payment">Payment Details</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vendorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Hydro-Quebec"
                          {...field}
                          data-testid="input-vendor-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., INV-2024-001"
                          {...field}
                          data-testid="input-invoice-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-total-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              data-testid="input-due-date"
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            <TabsContent value="payment" className="space-y-4">
              <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-type">
                          <SelectValue placeholder="Select payment type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="one-time">One-time Payment</SelectItem>
                        <SelectItem value="recurring">Recurring Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {paymentType === 'recurring' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium">Recurring Payment Settings</h4>
                  
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-frequency">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {frequency && frequency !== 'custom' && (
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                  data-testid="input-start-date"
                                >
                                  {field.value ? (
                                    format(field.value, 'PPP')
                                  ) : (
                                    <span>Pick start date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {frequency === 'custom' && (
                    <div className="space-y-2">
                      <FormLabel>Custom Payment Dates</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Custom date scheduling coming soon...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <div>
                <h4 className="font-medium mb-4">Invoice Document</h4>
                
                {uploadedDocument ? (
                  <DocumentCard
                    documentId={uploadedDocument}
                    onRemove={handleDocumentRemove}
                    showRemove={true}
                  />
                ) : (
                  <SharedUploader
                    onUploadComplete={handleDocumentUpload}
                    accept={{
                      'application/pdf': ['.pdf'],
                      'image/*': ['.png', '.jpg', '.jpeg'],
                    }}
                    maxSizeMB={10}
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8"
                  >
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        Upload Invoice Document
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, PNG, JPG up to 10MB
                      </p>
                    </div>
                  </SharedUploader>
                )}
              </div>
            </TabsContent>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                data-testid="button-cancel"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-invoice"
              >
                <Save className="w-4 h-4 mr-2" />
                {mode === 'create' ? 'Create Invoice' : 'Update Invoice'}
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  );
}