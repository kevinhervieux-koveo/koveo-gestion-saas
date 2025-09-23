import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { FormModal } from '@/components/maintenance/FormModal';
import {
  FormControl,
  FormDescription,
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
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { insertVendorSchema, Vendor } from '@shared/schemas/maintenance';
import { User, Phone, Mail, Building2, FileText } from 'lucide-react';

export interface VendorFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor;
  mode?: 'create' | 'edit';
  onSuccess?: (vendor: Vendor) => void;
  organizationId?: string;
  buildingId?: string;
}

// Extend the schema for client-side validation
const vendorFormSchema = insertVendorSchema.extend({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().max(20, 'Phone number must be less than 20 characters').optional(),
  category: z.string().max(100, 'Category must be less than 100 characters').optional(),
  contactPerson: z.string().max(100, 'Contact person must be less than 100 characters').optional(),
});

type VendorFormData = z.infer<typeof vendorFormSchema>;

const vendorCategories = [
  { value: 'general', label: 'General Contractor' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'painting', label: 'Painting' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'cleaning', label: 'Cleaning Services' },
  { value: 'security', label: 'Security Systems' },
  { value: 'elevator', label: 'Elevator Maintenance' },
  { value: 'fire_safety', label: 'Fire Safety' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'other', label: 'Other' },
];

/**
 * VendorForm component for creating and editing vendors
 * Uses FormModal foundation with comprehensive validation and integration
 */
export function VendorForm({
  isOpen,
  onOpenChange,
  vendor,
  mode = vendor ? 'edit' : 'create',
  onSuccess,
  organizationId,
  buildingId,
}: VendorFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with default values
  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      organizationId: vendor?.organizationId || organizationId || '',
      name: vendor?.name || '',
      category: vendor?.category || '',
      contactPerson: vendor?.contactPerson || '',
      phone: vendor?.phone || '',
      email: vendor?.email || '',
      notes: vendor?.notes || '',
    },
  });

  // Update form when organizationId prop changes
  useEffect(() => {
    if (organizationId && form.getValues('organizationId') !== organizationId) {
      form.setValue('organizationId', organizationId);
    }
  }, [organizationId, form]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: VendorFormData) => {
      const endpoint = vendor 
        ? `/api/maintenance/vendors/${vendor.id}`
        : '/api/maintenance/vendors';
      
      const method = vendor ? 'PUT' : 'POST';
      
      const response = await apiRequest(method, endpoint, {
        ...data,
        // Ensure empty strings are converted to null for optional fields
        category: data.category || null,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
      });
      
      return response.json();
    },
    onSuccess: (response) => {
      // Invalidate all vendor-related queries to ensure UI refreshes
      // This is more comprehensive to handle any edge cases with query key matching
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/vendors']
      });
      
      // Also invalidate building-specific vendor queries if buildingId is available
      // This ensures the ProjectForm's vendor dropdown refreshes immediately
      if (buildingId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/maintenance/vendors', buildingId] 
        });
      }
      
      // Additional invalidation to catch any other vendor-related queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 typeof queryKey[0] === 'string' && 
                 queryKey[0].includes('/api/maintenance/vendors');
        }
      });
      
      toast({
        title: mode === 'create' ? "Vendor Created" : "Vendor Updated",
        description: `Vendor "${response.data?.name}" has been ${mode === 'create' ? 'created' : 'updated'} successfully.`,
      });
      
      onSuccess?.(response.data);
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'An error occurred';
      setError(message);
      toast({
        title: mode === 'create' ? "Creation Failed" : "Update Failed",
        description: message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (data: VendorFormData) => {
    setIsSubmitting(true);
    setError(null);
    saveMutation.mutate(data);
  };

  const title = mode === 'create' ? 'Create New Vendor' : 'Edit Vendor';
  const description = mode === 'create'
    ? 'Add a new vendor to manage maintenance projects and track service providers.'
    : 'Update vendor information and contact details.';

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel={mode === 'create' ? 'Create Vendor' : 'Update Vendor'}
      size="lg"
      error={error}
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor Name *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="e.g., ABC Plumbing Services"
                      className="pl-10"
                      {...field}
                      data-testid="input-vendor-name"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  The legal or business name of the vendor
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ''}>
                  <FormControl>
                    <SelectTrigger data-testid="select-vendor-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vendorCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Primary service category for this vendor
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="e.g., John Smith"
                      className="pl-10"
                      {...field}
                      data-testid="input-contact-person"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Primary contact person at the vendor
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="e.g., +1 (555) 123-4567"
                      className="pl-10"
                      {...field}
                      data-testid="input-phone"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Primary phone number for contact
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="e.g., contact@abcplumbing.com"
                    className="pl-10"
                    {...field}
                    data-testid="input-email"
                  />
                </div>
              </FormControl>
              <FormDescription>
                Primary email address for communication
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    placeholder="Additional notes about this vendor, specialties, service quality, etc."
                    className="pl-10 min-h-[100px] resize-none"
                    {...field}
                    data-testid="textarea-notes"
                  />
                </div>
              </FormControl>
              <FormDescription>
                Additional information, service quality notes, specialties, etc.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormModal>
  );
}

export type { VendorFormData };