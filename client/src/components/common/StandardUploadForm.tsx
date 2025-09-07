import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileText } from 'lucide-react';
import { SharedUploader } from '@/components/document-management';
import type { UploadContext } from '@shared/config/upload-config';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: z.ZodType<any>;
}

interface StandardUploadFormProps {
  // Dialog props
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  
  // Form configuration
  fields: FormField[];
  onSubmit: (data: any, file: File | null, textContent: string | null) => Promise<void>;
  
  // Upload configuration
  uploadContext: UploadContext;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  showUpload?: boolean;
  uploadRequired?: boolean;
  
  // UI configuration
  submitText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
  
  // State
  isLoading?: boolean;
}

/**
 * StandardUploadForm - A unified form component for upload operations
 * Standardizes all upload forms across the application
 */
export function StandardUploadForm({
  isOpen,
  onClose,
  title,
  description,
  fields,
  onSubmit,
  uploadContext,
  allowedFileTypes,
  maxFileSize = 25,
  showUpload = true,
  uploadRequired = false,
  submitText = 'Submit',
  cancelText = 'Cancel',
  icon,
  isLoading = false,
}: StandardUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  
  // Create dynamic schema from fields
  const createSchema = () => {
    const schemaFields: Record<string, z.ZodType<any>> = {};
    
    fields.forEach(field => {
      if (field.validation) {
        schemaFields[field.name] = field.validation;
      } else if (field.type === 'text') {
        schemaFields[field.name] = field.required 
          ? z.string().min(1, `${field.label} is required`)
          : z.string().optional();
      } else if (field.type === 'textarea') {
        schemaFields[field.name] = field.required
          ? z.string().min(1, `${field.label} is required`)
          : z.string().optional();
      } else if (field.type === 'select') {
        schemaFields[field.name] = field.required
          ? z.string().min(1, `${field.label} is required`)
          : z.string().optional();
      }\n    });
    
    return z.object(schemaFields);
  };

  const form = useForm({
    resolver: zodResolver(createSchema()),
    defaultValues: fields.reduce((acc, field) => {
      acc[field.name] = field.type === 'select' ? (field.options?.[0]?.value || '') : '';
      return acc;
    }, {} as Record<string, any>),
  });

  const handleDocumentChange = (file: File | null, text: string | null) => {
    setSelectedFile(file);
    setTextContent(text);
  };

  const handleSubmit = async (data: any) => {
    // Validate upload requirement
    if (uploadRequired && !selectedFile && !textContent) {
      form.setError('root', {
        message: 'Please provide either a file or text content.',
      });
      return;
    }
    
    try {
      await onSubmit(data, selectedFile, textContent);
      // Reset form on success
      form.reset();
      setSelectedFile(null);
      setTextContent(null);
    } catch (error: any) {
      form.setError('root', {
        message: error.message || 'Submission failed',
      });
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      form.reset();
      setSelectedFile(null);
      setTextContent(null);
      onClose();
    }
  };

  const renderField = (field: FormField) => {
    return (
      <FormField
        key={field.name}
        control={form.control}
        name={field.name}
        render={({ field: formField }) => (
          <FormItem>
            <FormLabel>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </FormLabel>
            <FormControl>
              {field.type === 'text' ? (
                <Input
                  placeholder={field.placeholder}
                  {...formField}
                  data-testid={`input-${field.name}`}
                />
              ) : field.type === 'textarea' ? (
                <Textarea
                  placeholder={field.placeholder}
                  rows={4}
                  {...formField}
                  data-testid={`textarea-${field.name}`}
                />
              ) : field.type === 'select' ? (
                <Select onValueChange={formField.onChange} value={formField.value}>
                  <SelectTrigger data-testid={`select-${field.name}`}>
                    <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon || <FileText className="w-5 h-5" />}
            {title}
          </DialogTitle>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Form Fields */}
            <div className="space-y-4">
              {fields.map(renderField)}
            </div>

            {/* Upload Section */}
            {showUpload && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    {uploadRequired ? 'Document Content *' : 'Document Content (Optional)'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SharedUploader
                    onDocumentChange={handleDocumentChange}
                    formType={uploadContext.type}
                    uploadContext={uploadContext}
                    showAiToggle={false}
                    allowedFileTypes={allowedFileTypes}
                    maxFileSize={maxFileSize}
                    defaultTab="file"
                  />
                </CardContent>
              </Card>
            )}

            {/* Form Error */}
            {form.formState.errors.root && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-3 rounded-md">
                {form.formState.errors.root.message}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                {cancelText}
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-submit-form"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    {icon || <FileText className="w-4 h-4 mr-2" />}
                    {submitText}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}