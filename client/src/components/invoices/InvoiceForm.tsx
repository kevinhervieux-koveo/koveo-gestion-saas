import { useState, useCallback } from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

import { SharedUploader } from '@/components/document-management/SharedUploader';
import { GeminiInvoiceExtractor } from './GeminiInvoiceExtractor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { CurrencyInputField } from '@/components/common/CurrencyInputField';
import { StandardFormGrid } from '@/components/common/StandardFormGrid';
import { DatePickerField } from '@/components/common/DatePickerField';
import { apiRequest } from '@/lib/queryClient';
import { useCreateUpdateMutation } from '@/lib/common-hooks';

import { invoiceFormSchema, InvoiceFormData, Invoice } from '@shared/schema';

const toIsoDateString = (date?: Date | string | null): string | undefined => {
  if (!date) return undefined;
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return undefined;
  return value.toISOString().slice(0, 10);
};

const buildInvoicePayload = (data: InvoiceFormData) => {
  const payload: Record<string, unknown> = {
    vendorName: data.vendorName,
    invoiceNumber: data.invoiceNumber,
    totalAmount: data.totalAmount,
    dueDate: toIsoDateString(data.dueDate),
    paymentType: data.paymentType,
    isAiExtracted: data.isAiExtracted ?? false,
  };

  if (data.paymentType === 'recurring' && data.frequency) {
    payload.frequency = data.frequency;
    if (data.frequency === 'custom') {
      payload.customPaymentDates = (data.customPaymentDates ?? [])
        .map((d) => toIsoDateString(d))
        .filter((d): d is string => Boolean(d));
    } else {
      payload.startDate = toIsoDateString(data.startDate);
    }
  }

  if (data.documentId) payload.documentId = data.documentId;
  if (data.buildingId) payload.buildingId = data.buildingId;
  if (data.residenceId) payload.residenceId = data.residenceId;
  if (typeof data.extractionConfidence === 'number') {
    payload.extractionConfidence = data.extractionConfidence;
  }

  return payload;
};

interface InvoiceFormProps {
  /** Optional building ID to associate the invoice with */
  buildingId?: string;
  /** Optional residence ID to associate the invoice with */
  residenceId?: string;
  /** Success callback when invoice is created/updated */
  onSuccess?: (invoice: any) => void;
  /** Cancel callback */
  onCancel?: () => void;
  /** Initial data for editing mode */
  initialData?: Partial<InvoiceFormData>;
  /** Existing invoice (required for edit mode so we know which record to update) */
  invoice?: Pick<Invoice, 'id'> & Partial<Invoice>;
  /** Form mode */
  mode?: 'create' | 'edit';
}

/**
 * InvoiceForm Component
 * 
 * A comprehensive form for creating and editing invoices with AI-powered data extraction.
 * Integrates SharedUploader for file handling and GeminiInvoiceExtractor for automatic
 * field population from uploaded invoice documents.
 * 
 * Features:
 * - SharedUploader integration for file and text content
 * - AI-powered invoice data extraction with confidence scoring
 * - Conditional recurring payment fields with standard and custom frequencies
 * - Dynamic custom date management with useFieldArray
 * - Real-time form validation with Zod
 * - Mobile-optimized responsive design
 */
export function InvoiceForm({
  buildingId,
  residenceId,
  onSuccess,
  onCancel,
  initialData,
  invoice,
  mode = invoice ? 'edit' : 'create'
}: InvoiceFormProps) {
  const { toast } = useToast();
  
  // State for uploaded file and AI extraction
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<{
    loading: boolean;
    success: boolean;
    confidence?: number;
    error?: string;
  }>({ loading: false, success: false });

  // Form setup with validation
  const form: UseFormReturn<InvoiceFormData> = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema) as any,
    defaultValues: {
      vendorName: initialData?.vendorName || '',
      invoiceNumber: initialData?.invoiceNumber || '',
      totalAmount: initialData?.totalAmount?.toString() || '',
      dueDate: initialData?.dueDate || new Date(),
      paymentType: initialData?.paymentType || 'one-time',
      frequency: initialData?.frequency || undefined,
      startDate: initialData?.startDate || undefined,
      customPaymentDates: initialData?.customPaymentDates || [],
      buildingId: buildingId,
      residenceId: residenceId,
      isAiExtracted: initialData?.isAiExtracted || false,
      ...initialData
    }
  });

  // Field array for custom payment dates
  const fieldArray = useFieldArray({
    control: form.control as any,
    name: 'customPaymentDates',
  }) as any;
  const { fields, append, remove } = fieldArray;

  // Watch payment type and frequency for conditional rendering
  const paymentType = form.watch('paymentType');
  const frequency = form.watch('frequency');

  // Handle file upload from SharedUploader
  const handleDocumentChange = useCallback((file: File | null, textContent?: string) => {
    if (file) {
      // File uploaded for invoice processing
      setUploadedFile(file);
      setExtractionStatus({ loading: true, success: false });
    } else if (textContent) {
      // Text content provided - no AI extraction needed
      toast({
        title: "Text Content Added",
        description: "You can now fill in the invoice details manually.",
      });
    }
  }, [toast]);

  // Handle AI extraction completion
  const handleExtractionComplete = useCallback((result: {
    success: boolean;
    formData?: any;
    confidence?: number;
    error?: string;
  }) => {
    setExtractionStatus({
      loading: false,
      success: result.success,
      confidence: result.confidence,
      error: result.error
    });

    if (result.success && result.formData) {
      // AI extraction successful - populating form data
      
      // Populate form with extracted data using reset
      form.reset({
        ...form.getValues(),
        ...result.formData,
        isAiExtracted: true,
        extractionConfidence: result.confidence
      });

      toast({
        title: "AI Extraction Successful",
        description: `Invoice data extracted with ${Math.round((result.confidence || 0) * 100)}% confidence. Please review and adjust as needed.`,
      });
    } else if (result.error) {
      console.error('[INVOICE FORM] AI extraction failed:', result.error);
      
      toast({
        title: "Extraction Failed",
        description: result.error,
        variant: "destructive",
      });
    }
  }, [form, toast]);

  // Add custom payment date
  const addCustomDate = () => {
    append(new Date() as any);
  };

  // Remove custom payment date
  const removeCustomDate = (index: number) => {
    remove(index);
  };

  // Create/update mutation - mirrors the pattern used in VendorForm/ElementForm/ProjectForm.
  const saveMutation = useCreateUpdateMutation<{ data: Invoice }, InvoiceFormData>({
    mutationFn: async (data) => {
      const payload = buildInvoicePayload(data);
      const endpoint = mode === 'edit' && invoice?.id
        ? `/api/invoices/${invoice.id}`
        : '/api/invoices';
      const method = mode === 'edit' && invoice?.id ? 'PUT' : 'POST';

      const response = await apiRequest(method, endpoint, payload);
      return response.json();
    },
    successTitle: mode === 'edit' ? 'Invoice Updated' : 'Invoice Created',
    successMessage: 'Invoice has been successfully saved.',
    errorTitle: mode === 'edit' ? 'Update Failed' : 'Creation Failed',
    errorMessage: (error: any) => error?.message || 'Failed to save invoice',
    invalidateQueries: (_data, qc) => {
      qc.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            typeof key[0] === 'string' &&
            key[0].startsWith('/api/invoices')
          );
        },
      });
    },
    onSuccessCallback: (response) => {
      onSuccess?.(response?.data);
    },
  });

  // Form submission
  const onSubmit = (data: InvoiceFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* AI Extraction Status */}
      {extractionStatus.loading && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Extracting invoice data with AI... This may take a few seconds.
          </AlertDescription>
        </Alert>
      )}
      
      {extractionStatus.success && extractionStatus.confidence !== undefined && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            AI extraction completed with {Math.round(extractionStatus.confidence * 100)}% confidence.
            <Badge variant="outline" className="ml-2">
              {extractionStatus.confidence > 0.8 ? 'High Confidence' : 
               extractionStatus.confidence > 0.5 ? 'Medium Confidence' : 'Low Confidence'}
            </Badge>
          </AlertDescription>
        </Alert>
      )}
      
      {extractionStatus.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {extractionStatus.error}
          </AlertDescription>
        </Alert>
      )}

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Invoice Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SharedUploader
            onDocumentChange={handleDocumentChange}
            allowedFileTypes={['application/pdf', 'image/*']}
            maxFileSize={25}
            defaultTab="file"
            data-testid="invoice-uploader"
          />
          
          {uploadedFile && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Uploaded: <span className="font-medium">{uploadedFile.name}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Extraction Component (No UI) */}
      <GeminiInvoiceExtractor
        file={uploadedFile}
        onExtractionComplete={handleExtractionComplete}
      />

      {/* Invoice Form */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Basic Invoice Information */}
              <StandardFormGrid gap="lg">
                
                {/* Vendor Name */}
                <FormField
                  control={form.control}
                  name="vendorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., Hydro Quebec"
                          data-testid="input-vendor-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Invoice Number */}
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., INV-2024-001"
                          data-testid="input-invoice-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Total Amount */}
                <CurrencyInputField
                  control={form.control}
                  name="totalAmount"
                  label="Total Amount"
                  required
                  data-testid="input-total-amount"
                />

                {/* Due Date */}
                <DatePickerField
                  control={form.control}
                  name="dueDate"
                  label="Due Date"
                  required
                  minDate={new Date("1900-01-01")}
                  data-testid="button-due-date"
                />
              </StandardFormGrid>

              <Separator />

              {/* Payment Type Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Payment Structure</h3>
                
                <FormField
                  control={form.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Type *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-2"
                          data-testid="radio-payment-type"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="one-time" id="one-time" />
                            <label htmlFor="one-time" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              One-time Payment
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="recurring" id="recurring" />
                            <label htmlFor="recurring" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Recurring Payment
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Recurring Payment Options */}
                {paymentType === 'recurring' && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium">Recurring Payment Options</h4>
                    
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequency *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="grid grid-cols-2 gap-4"
                              data-testid="radio-frequency"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="monthly" id="monthly" />
                                <label htmlFor="monthly" className="text-sm">Monthly</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="quarterly" id="quarterly" />
                                <label htmlFor="quarterly" className="text-sm">Quarterly</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="annually" id="annually" />
                                <label htmlFor="annually" className="text-sm">Annually</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="custom" id="custom" />
                                <label htmlFor="custom" className="text-sm">Custom Dates</label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Start Date for Standard Frequencies */}
                    {frequency && ['monthly', 'quarterly', 'annually'].includes(frequency) && (
                      <DatePickerField
                        control={form.control}
                        name="startDate"
                        label="Start Date"
                        required
                        placeholder="Pick start date"
                        minDate={new Date("1900-01-01")}
                        data-testid="button-start-date"
                      />
                    )}

                    {/* Custom Payment Dates */}
                    {frequency === 'custom' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <FormLabel>Custom Payment Dates *</FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addCustomDate}
                            data-testid="button-add-date"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Date
                          </Button>
                        </div>
                        
                        {fields.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No custom dates added. Click "Add Date" to add payment dates.
                          </p>
                        )}
                        
                        <div className="space-y-3">
                          {fields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-3">
                              <DatePickerField<InvoiceFormData>
                                control={form.control}
                                name={`customPaymentDates.${index}` as `customPaymentDates.${number}`}
                                label=""
                                className="flex-1"
                                disabledDates={(date) => date < new Date()}
                                data-testid={`button-custom-date-${index}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeCustomDate(index)}
                                data-testid={`button-remove-date-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-6">
                {onCancel && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit"
                  disabled={saveMutation.isPending}
                  data-testid="button-submit"
                >
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {mode === 'create' ? 'Create Invoice' : 'Update Invoice'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export type { InvoiceFormProps };