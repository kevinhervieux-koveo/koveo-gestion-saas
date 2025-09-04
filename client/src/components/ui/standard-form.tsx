import React from 'react';
import { useForm, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/hooks/use-language';

/**
 * Supported form field types
 */
/**
 * FieldType type definition.
 */
/**
 * FieldType type definition.
 */
export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'number';

/**
 * Configuration for a single form field
 */
/**
 * FormFieldConfig type definition.
 */
/**
 * FormFieldConfig type definition.
 */
export interface FormFieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  description?: string;
  options?: Array<{ _value: string; label: string }>;
  rows?: number;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

/**
 * Props for the StandardForm component
 */
interface StandardFormProps {
  schema: z.ZodType<Record<string, unknown>>;
  fields: FormFieldConfig[];
  onSubmit: (_data: Record<string, unknown>) => void | Promise<void>;
  defaultValues?: Record<string, unknown>;
  submitText?: string;
  cancelText?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  showCancel?: boolean;
  showCancelButton?: boolean;
  className?: string;
  children?: React.ReactNode;
  layout?: string;
}

/**
 * Standard Form Component
 *
 * Provides reusable form handling with validation, consistent styling,
 * and standardized field types to reduce form code duplication.
 *
 * @param props - Form configuration and handlers
 * @returns Standardized form component
 */
/**
 * StandardForm function
 * @returns Function result
 */
/**
 * StandardForm component.
 * @param props - Component props.
 * @param props.schema - schema parameter.
 * @param props.fields - fields parameter.
 * @param props.onSubmit - Callback function called when form is submitted.
 * @param props.defaultValues - defaultValues parameter.
 * @param props.submitText - submitText parameter.
 * @param props.cancelText - cancelText parameter.
 * @param props.onCancel - Callback function called when operation is cancelled.
 * @param props.isLoading = false - isLoading = false parameter.
 * @param props.showCancel = false - showCancel = false parameter.
 * @param props.className = '' - className = '' parameter.
 * @param props.children - React children elements.
 * @returns JSX element.
 */
/**
 * Standard form function.
 * @param {
  schema - {
  schema parameter.
 * @param fields - fields parameter.
 * @param onSubmit - onSubmit parameter.
 * @param defaultValues - defaultValues parameter.
 * @param submitText - submitText parameter.
 * @param cancelText - cancelText parameter.
 * @param onCancel - onCancel parameter.
 * @param isLoading = false - isLoading = false parameter.
 * @param showCancel = false - showCancel = false parameter.
 * @param className = '' - className = '' parameter.
 * @param children
} - children
} parameter.
 */
export function /**
   * Standard form function.
   * @param {
  schema - {
  schema parameter.
   * @param fields - fields parameter.
   * @param onSubmit - onSubmit parameter.
   * @param defaultValues - defaultValues parameter.
   * @param submitText - submitText parameter.
   * @param cancelText - cancelText parameter.
   * @param onCancel - onCancel parameter.
   * @param isLoading = false - isLoading = false parameter.
   * @param showCancel = false - showCancel = false parameter.
   * @param className = '' - className = '' parameter.
   * @param children
} - children
} parameter.
   */ /**
   * Standard form function.
   * @param {
  schema - {
  schema parameter.
   * @param fields - fields parameter.
   * @param onSubmit - onSubmit parameter.
   * @param defaultValues - defaultValues parameter.
   * @param submitText - submitText parameter.
   * @param cancelText - cancelText parameter.
   * @param onCancel - onCancel parameter.
   * @param isLoading = false - isLoading = false parameter.
   * @param showCancel = false - showCancel = false parameter.
   * @param className = '' - className = '' parameter.
   * @param children
} - children
} parameter.
   */

StandardForm({
  schema,
  fields,
  onSubmit,
  defaultValues,
  submitText,
  cancelText,
  onCancel,
  isLoading = false,
  showCancel = false,
  className = '',
  children,
}: StandardFormProps) {
  const { t } = useLanguage();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleSubmit = async (_data: unknown) => {
    try {
      await onSubmit(data as Record<string, unknown>);
      /**
       * Catch function.
       * @param _error - _error parameter.
       */ /**
       * Catch function.
       * @param _error - _error parameter.
       */

    }
  };

  const renderField = (fieldConfig: FormFieldConfig) => {
    const {
      name,
      label,
      type,
      placeholder,
      description,
      options,
      rows,
      disabled,
      className: fieldClassName,
    } = fieldConfig;

    return (
      <FormField
        key={name}
        control={form.control}
        name={name as never}
        render={({ field }) => (
          <FormItem className={fieldClassName}>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              {type === 'text' || type === 'email' || type === 'password' ? (
                <Input type={type} placeholder={placeholder} disabled={disabled} {...field} />
              ) : type === 'number' ? (
                <Input
                  type='number'
                  placeholder={placeholder}
                  disabled={disabled}
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target._value))}
                />
              ) : type === 'textarea' ? (
                <Textarea
                  placeholder={placeholder}
                  rows={rows || 3}
                  disabled={disabled}
                  {...field}
                />
              ) : type === 'select' ? (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : type === 'checkbox' ? (
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={disabled}
                  />
                  <label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                    {placeholder}
                  </label>
                </div>
              ) : null}
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={`space-y-4 ${className}`}>
        {fields.map(renderField)}

        {children}

        <div className='flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4'>
          {showCancel && onCancel && (
            <Button type='button' variant='outline' onClick={onCancel} disabled={isLoading}>
              {cancelText || t('cancel')}
            </Button>
          )}

          <Button type='submit' disabled={isLoading}>
            {isLoading ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                Processing...
              </>
            ) : (
              submitText || 'Submit'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
