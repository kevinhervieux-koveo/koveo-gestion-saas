import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/hooks/use-language';
import { BILL_CATEGORIES } from '@shared/schemas/financial';
import { cn } from '@/lib/utils';

const CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  administration: 'administration',
  cleaning: 'cleaning',
  construction: 'construction',
  consulting: 'consulting',
  equipment_rental: 'equipmentRental',
  insurance: 'insurance',
  landscaping: 'landscaping',
  legal_services: 'legalServices',
  maintenance: 'maintenance',
  professional_services: 'professionalServices',
  repairs: 'repairs',
  reserves: 'reserves',
  salary: 'salary',
  security: 'security',
  supplies: 'supplies',
  taxes: 'taxes',
  technology: 'technology',
  utilities: 'utilities',
  other: 'other',
};

interface CategorySelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function CategorySelectField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  'data-testid': testId = 'select-bill-category',
}: CategorySelectFieldProps<T>) {
  const { t } = useLanguage();

  const displayLabel = label ?? t('category');
  const displayPlaceholder = placeholder ?? t('selectCategory');

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn(className)}>
          <FormLabel>{required ? `${displayLabel} *` : displayLabel}</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger data-testid={testId}>
                <SelectValue placeholder={displayPlaceholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {BILL_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {t(CATEGORY_TRANSLATION_KEYS[category] || category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
