import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

/**
 *
 */
interface Residence {
  id: string;
  unitNumber: string;
  floor: number;
  squareFootage: string;
  bedrooms: number;
  bathrooms: string;
  balcony: boolean;
  parkingSpaceNumbers: string[];
  storageSpaceNumbers: string[];
  ownershipPercentage: string;
  monthlyFees: string;
  isActive: boolean;
  building: {
    id: string;
    name: string;
  };
}

const residenceEditSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  floor: z.number().min(0, 'Floor must be 0 or greater').optional(),
  squareFootage: z.string().optional(),
  bedrooms: z.number().min(0, 'Bedrooms must be 0 or greater').optional(),
  bathrooms: z.string().optional(),
  balcony: z.boolean(),
  parkingSpaceNumbers: z.array(z.string()).optional(),
  storageSpaceNumbers: z.array(z.string()).optional(),
  ownershipPercentage: z.string().optional(),
  monthlyFees: z.string().optional(),
});

/**
 *
 */
type ResidenceEditFormData = z.infer<typeof residenceEditSchema>;

/**
 *
 */
interface ResidenceEditFormProps {
  residence: Residence;
  onSuccess: () => void;
}

/**
 *
 * @param root0
 * @param root0.residence
 * @param root0.onSuccess
 */
/**
 * ResidenceEditForm function.
 * @param root0
 * @param root0.residence
 * @param root0.onSuccess
 * @returns Function result.
 */
export function ResidenceEditForm({ residence, onSuccess }: ResidenceEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [parkingSpaces, setParkingSpaces] = useState<string[]>(
    residence.parkingSpaceNumbers || []
  );
  const [storageSpaces, setStorageSpaces] = useState<string[]>(
    residence.storageSpaceNumbers || []
  );
  const [newParkingSpace, setNewParkingSpace] = useState('');
  const [newStorageSpace, setNewStorageSpace] = useState('');

  const form = useForm<ResidenceEditFormData>({
    resolver: zodResolver(residenceEditSchema),
    defaultValues: {
      unitNumber: residence.unitNumber,
      floor: residence.floor || 0,
      squareFootage: residence.squareFootage || '',
      bedrooms: residence.bedrooms || 0,
      bathrooms: residence.bathrooms || '',
      balcony: residence.balcony || false,
      parkingSpaceNumbers: residence.parkingSpaceNumbers || [],
      storageSpaceNumbers: residence.storageSpaceNumbers || [],
      ownershipPercentage: residence.ownershipPercentage || '',
      monthlyFees: residence.monthlyFees || '',
    },
  });

  const updateResidenceMutation = useMutation({
    mutationFn: async (_data: ResidenceEditFormData) => {
      const response = await fetch(`/api/residences/${residence.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          parkingSpaceNumbers: parkingSpaces,
          storageSpaceNumbers: storageSpaces,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update residence');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Residence updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/residences'] });
      onSuccess();
    },
    onError: (_error: unknown) => {
      toast({
        title: 'Error',
        description: (error as Error)?.message || 'Failed to update residence',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (_data: ResidenceEditFormData) => {
    updateResidenceMutation.mutate(_data);
  };

  const addParkingSpace = () => {
    if (newParkingSpace.trim() && !parkingSpaces.includes(newParkingSpace.trim())) {
      setParkingSpaces([...parkingSpaces, newParkingSpace.trim()]);
      setNewParkingSpace('');
    }
  };

  const removeParkingSpace = (_index: number) => {
    setParkingSpaces(parkingSpaces.filter((_, i) => i !== _index));
  };

  const addStorageSpace = () => {
    if (newStorageSpace.trim() && !storageSpaces.includes(newStorageSpace.trim())) {
      setStorageSpaces([...storageSpaces, newStorageSpace.trim()]);
      setNewStorageSpace('');
    }
  };

  const removeStorageSpace = (_index: number) => {
    setStorageSpaces(storageSpaces.filter((_, i) => i !== _index));
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='unitNumber'>Unit Number</Label>
              <Input
                id='unitNumber'
                {...form.register('unitNumber')}
              />
              {form.formState.errors.unitNumber && (
                <p className='text-sm text-red-500'>{form.formState.errors.unitNumber.message}</p>
              )}
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='floor'>Floor</Label>
              <Input
                id='floor'
                type='number'
                min='0'
                {...form.register('floor', { valueAsNumber: true })}
              />
              {form.formState.errors.floor && (
                <p className='text-sm text-red-500'>{form.formState.errors.floor.message}</p>
              )}
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='squareFootage'>Square Footage</Label>
              <Input
                id='squareFootage'
                placeholder='e.g., 1200'
                {...form.register('squareFootage')}
              />
              {form.formState.errors.squareFootage && (
                <p className='text-sm text-red-500'>{form.formState.errors.squareFootage.message}</p>
              )}
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='monthlyFees'>Monthly Fees ($)</Label>
              <Input
                id='monthlyFees'
                placeholder='e.g., 350.00'
                {...form.register('monthlyFees')}
              />
              {form.formState.errors.monthlyFees && (
                <p className='text-sm text-red-500'>{form.formState.errors.monthlyFees.message}</p>
              )}
            </div>
          </div>

          <div className='grid grid-cols-3 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='bedrooms'>Bedrooms</Label>
              <Input
                id='bedrooms'
                type='number'
                min='0'
                {...form.register('bedrooms', { valueAsNumber: true })}
              />
              {form.formState.errors.bedrooms && (
                <p className='text-sm text-red-500'>{form.formState.errors.bedrooms.message}</p>
              )}
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='bathrooms'>Bathrooms</Label>
              <Input
                id='bathrooms'
                placeholder='e.g., 2.5'
                {...form.register('bathrooms')}
              />
              {form.formState.errors.bathrooms && (
                <p className='text-sm text-red-500'>{form.formState.errors.bathrooms.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='ownershipPercentage'>Ownership %</Label>
              <Input
                id='ownershipPercentage'
                placeholder='e.g., 0.025'
                {...form.register('ownershipPercentage')}
              />
              {form.formState.errors.ownershipPercentage && (
                <p className='text-sm text-red-500'>{form.formState.errors.ownershipPercentage.message}</p>
              )}
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            <Switch
              id='balcony'
              checked={form.watch('balcony')}
              onCheckedChange={(checked) => form.setValue('balcony', checked)}
            />
            <Label htmlFor='balcony'>Has Balcony</Label>
          </div>
        </CardContent>
      </Card>

      {/* Parking Spaces */}
      <Card>
        <CardHeader>
          <CardTitle>Parking Spaces</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap gap-2'>
            {parkingSpaces.map((space, _index) => (
              <Badge key={index} variant='secondary' className='flex items-center gap-1'>
                {space}
                <X
                  className='w-3 h-3 cursor-pointer'
                  onClick={() => removeParkingSpace(_index)}
                />
              </Badge>
            ))}
          </div>
          
          <div className='flex gap-2'>
            <Input
              placeholder='Add parking space number'
              value={newParkingSpace}
              onChange={(e) => setNewParkingSpace(e.target._value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addParkingSpace())}
            />
            <Button type='button' onClick={addParkingSpace} size='sm'>
              <Plus className='w-4 h-4' />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storage Spaces */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Spaces</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap gap-2'>
            {storageSpaces.map((space, _index) => (
              <Badge key={index} variant='secondary' className='flex items-center gap-1'>
                {space}
                <X
                  className='w-3 h-3 cursor-pointer'
                  onClick={() => removeStorageSpace(_index)}
                />
              </Badge>
            ))}
          </div>
          
          <div className='flex gap-2'>
            <Input
              placeholder='Add storage space number'
              value={newStorageSpace}
              onChange={(e) => setNewStorageSpace(e.target._value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addStorageSpace())}
            />
            <Button type='button' onClick={addStorageSpace} size='sm'>
              <Plus className='w-4 h-4' />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className='flex justify-end gap-2'>
        <Button
          type='submit'
          disabled={updateResidenceMutation.isPending}
        >
          {updateResidenceMutation.isPending ? 'Updating...' : 'Update Residence'}
        </Button>
      </div>
    </form>
  );
}