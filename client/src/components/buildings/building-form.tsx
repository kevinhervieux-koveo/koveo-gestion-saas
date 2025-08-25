import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
// Textarea component removed (unused)
import { Button } from '@/components/ui/button';
import { UseFormReturn } from 'react-hook-form';
import { BuildingFormData, Organization } from './types';

/**
 * Interface for BuildingForm component props.
 */
interface BuildingFormProps {
  isOpen: boolean;
  onOpenChange: (_open: boolean) => void;
  form: UseFormReturn<BuildingFormData>;
  onSubmit: (_data: BuildingFormData) => void;
  organizations: Organization[];
  isSubmitting?: boolean;
  title: string;
  submitLabel: string;
}

/**
 * Reusable building form component for creating and editing buildings.
 * @param root0 - Building form component props.
 * @param root0.isOpen - Whether the dialog is open.
 * @param root0.onOpenChange - Callback when dialog open state changes.
 * @param root0.form - React Hook Form instance.
 * @param root0.onSubmit - Form submission handler.
 * @param root0.organizations - Available organizations for selection.
 * @param root0.isSubmitting - Whether form is currently submitting.
 * @param root0.title - Dialog title text.
 * @param root0.submitLabel - Submit button text.
 * @returns JSX element for the building form dialog.
 */
/**
 * BuildingForm function.
 * @param root0
 * @param root0.isOpen
 * @param root0.onOpenChange
 * @param root0.form
 * @param root0.onSubmit
 * @param root0.organizations
 * @param root0.isSubmitting
 * @param root0.title
 * @param root0.submitLabel
 * @returns Function result.
 */
export function BuildingForm({
  isOpen,
  onOpenChange,
  form,
  onSubmit,
  organizations,
  isSubmitting = false,
  title,
  submitLabel,
}: BuildingFormProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            {/* Required Fields */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building Name *</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter building name' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='organizationId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select organization' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name} ({org.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address Information */}
            <div className='space-y-4'>
              <FormField
                control={form.control}
                name='address'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter street address' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <FormField
                  control={form.control}
                  name='city'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder='Montreal' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='province'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='QC'>Quebec</SelectItem>
                          <SelectItem value='ON'>Ontario</SelectItem>
                          <SelectItem value='BC'>British Columbia</SelectItem>
                          <SelectItem value='AB'>Alberta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='postalCode'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder='H1A 1B1' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Building Type */}
            <FormField
              control={form.control}
              name='buildingType'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Building Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='condo'>Condo</SelectItem>
                      <SelectItem value='rental'>Rental</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional Building Details */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <FormField
                control={form.control}
                name='yearBuilt'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year Built</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='2020'
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : Number(e.target._value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='totalUnits'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Units</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='100'
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : Number(e.target._value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='totalFloors'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Floors</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='10'
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : Number(e.target._value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='parkingSpaces'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parking Spaces</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='50'
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : Number(e.target._value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='storageSpaces'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Spaces</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='25'
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : Number(e.target._value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='managementCompany'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Management Company</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter management company name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-end gap-2 pt-4'>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : submitLabel}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
