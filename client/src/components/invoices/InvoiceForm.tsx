import { useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, Plus, X, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

import { SharedUploader } from '@/components/document-management/SharedUploader';
import { GeminiInvoiceExtractor } from './GeminiInvoiceExtractor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

import { invoiceFormSchema, InvoiceFormData } from '@shared/schema';
import { cn } from '@/lib/utils';

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
  mode = 'create'
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
  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      vendorName: initialData?.vendorName || '',
      invoiceNumber: initialData?.invoiceNumber || '',
      totalAmount: initialData?.totalAmount || 0,
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
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'customPaymentDates'
  });

  // Watch payment type and frequency for conditional rendering
  const paymentType = form.watch('paymentType');
  const frequency = form.watch('frequency');

  // Handle file upload from SharedUploader
  const handleDocumentChange = useCallback((file: File | null, textContent?: string) => {
    if (file) {
      console.log('[INVOICE FORM] File uploaded:', file.name);
      setUploadedFile(file);
      setExtractionStatus({ loading: true, success: false });
    } else if (textContent) {
      console.log('[INVOICE FORM] Text content provided - no AI extraction needed');
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
      console.log('[INVOICE FORM] AI extraction successful:', result.formData);
      
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
    append(new Date());
  };

  // Remove custom payment date
  const removeCustomDate = (index: number) => {
    remove(index);
  };

  // Form submission
  const onSubmit = async (data: InvoiceFormData) => {
    try {
      console.log('[INVOICE FORM] Submitting invoice:', data);
      
      // TODO: Implement API call to create/update invoice
      // This will be implemented in the next task
      
      toast({
        title: mode === 'create' ? "Invoice Created" : "Invoice Updated",
        description: "Invoice has been successfully saved.",
      });
      
      onSuccess?.(data);
    } catch (error: any) {
      console.error('[INVOICE FORM] Submission error:', error);
      
      toast({
        title: "Error",
        description: error.message || "Failed to save invoice",
        variant: "destructive",
      });
    }
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
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
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount (CAD) *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-total-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-due-date"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
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
                            disabled={(date) => date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date *</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    data-testid="button-start-date"
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
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
                                  disabled={(date) => date < new Date("1900-01-01")}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
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
                              <FormField
                                control={form.control}
                                name={`customPaymentDates.${index}`}
                                render={({ field: dateField }) => (
                                  <FormItem className="flex-1">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <FormControl>
                                          <Button
                                            variant="outline"
                                            className={cn(
                                              "w-full pl-3 text-left font-normal",
                                              !dateField.value && "text-muted-foreground"
                                            )}
                                            data-testid={`button-custom-date-${index}`}
                                          >
                                            {dateField.value ? (
                                              format(dateField.value, "PPP")
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
                                          selected={dateField.value}
                                          onSelect={dateField.onChange}
                                          disabled={(date) => date < new Date()}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                  </FormItem>
                                )}
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
                  data-testid="button-submit"
                >
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