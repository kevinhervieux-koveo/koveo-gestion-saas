import { useState } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';

import { StandardForm, type FormFieldConfig } from '@/components/ui/standard-form';
import { useUpdateMutation } from '@/hooks/use-api-handler';
import { useToast } from '@/hooks/use-toast';

// Interface for residence data
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

// Validation schema
const residenceEditSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  floor: z.number().min(0, 'Floor must be 0 or greater').optional(),
  squareFootage: z.string().optional(),
  bedrooms: z.number().min(0, 'Bedrooms must be 0 or greater').optional(),
  bathrooms: z.string().optional(),
  balcony: z.boolean(),
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
 * Residence Edit Form Component - Refactored using reusable components
 * Reduced from 347+ lines to ~170 lines by leveraging StandardForm and API hooks.
 * @param root0
 * @param root0.residence
 * @param root0.onSuccess
 */
export function ResidenceEditForm({ residence, onSuccess }: ResidenceEditFormProps) {
  const { toast } = useToast();
  const [parkingSpaces, setParkingSpaces] = useState<string[]>(residence.parkingSpaceNumbers || []);
  const [storageSpaces, setStorageSpaces] = useState<string[]>(residence.storageSpaceNumbers || []);
  const [newParkingSpace, setNewParkingSpace] = useState('');
  const [newStorageSpace, setNewStorageSpace] = useState('');

  // API mutation using reusable hook
  const updateResidenceMutation = useUpdateMutation<Residence, ResidenceEditFormData & {
    parkingSpaceNumbers: string[];
    storageSpaceNumbers: string[];
  }>(
    `/api/residences/${residence.id}`,
    {
      successMessage: `Residence ${residence.unitNumber} updated successfully`,
      invalidateQueries: ['/api/residences', `/api/residences/${residence.id}`],
      onSuccessCallback: onSuccess,
    }
  );

  // Form field configuration
  const getFormFields = (): FormFieldConfig[] => [
    {
      name: 'unitNumber',
      label: 'Unit Number',
      type: 'text',
      placeholder: 'e.g., 101, 2A, Penthouse',
      required: true,
    },
    {
      name: 'floor',
      label: 'Floor',
      type: 'number',
      placeholder: 'Floor number (0 for ground)',
    },
    {
      name: 'squareFootage',
      label: 'Square Footage',
      type: 'text',
      placeholder: 'e.g., 1200 sq ft',
    },
    {
      name: 'bedrooms',
      label: 'Bedrooms',
      type: 'number',
      placeholder: 'Number of bedrooms',
    },
    {
      name: 'bathrooms',
      label: 'Bathrooms',
      type: 'text',
      placeholder: 'e.g., 2.5, 3 full',
    },
    {
      name: 'balcony',
      label: 'Has Balcony',
      type: 'switch',
      description: 'Does this residence have a balcony?',
    },
    {
      name: 'ownershipPercentage',
      label: 'Ownership Percentage',
      type: 'text',
      placeholder: 'e.g., 2.5%',
    },
    {
      name: 'monthlyFees',
      label: 'Monthly Fees',
      type: 'text',
      placeholder: 'e.g., $350.00',
    },
  ];

  // Parking space management
  const addParkingSpace = () => {
    if (newParkingSpace.trim() && !parkingSpaces.includes(newParkingSpace.trim())) {
      setParkingSpaces([...parkingSpaces, newParkingSpace.trim()]);
      setNewParkingSpace('');
    }
  };

  const removeParkingSpace = (space: string) => {
    setParkingSpaces(parkingSpaces.filter(s => s !== space));
  };

  // Storage space management  
  const addStorageSpace = () => {
    if (newStorageSpace.trim() && !storageSpaces.includes(newStorageSpace.trim())) {
      setStorageSpaces([...storageSpaces, newStorageSpace.trim()]);
      setNewStorageSpace('');
    }
  };

  const removeStorageSpace = (space: string) => {
    setStorageSpaces(storageSpaces.filter(s => s !== space));
  };

  // Handle form submission
  const handleSubmit = (data: ResidenceEditFormData) => {
    updateResidenceMutation.mutate({
      ...data,
      parkingSpaceNumbers: parkingSpaces,
      storageSpaceNumbers: storageSpaces,
    });
  };

  return (
    <div className="space-y-6">
      {/* Residence Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Edit Residence - Unit {residence.unitNumber}
            <Badge variant={residence.isActive ? 'success' : 'secondary'}>
              {residence.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Building: {residence.building.name}
          </p>
        </CardHeader>
      </Card>

      {/* Basic Information Form */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <StandardForm
            schema={residenceEditSchema}
            fields={getFormFields()}
            onSubmit={handleSubmit}
            isLoading={updateResidenceMutation.isPending}
            submitText="Update Residence"
            defaultValues={{
              unitNumber: residence.unitNumber,
              floor: residence.floor,
              squareFootage: residence.squareFootage || '',
              bedrooms: residence.bedrooms,
              bathrooms: residence.bathrooms || '',
              balcony: residence.balcony,
              ownershipPercentage: residence.ownershipPercentage || '',
              monthlyFees: residence.monthlyFees || '',
            }}
          />
        </CardContent>
      </Card>

      {/* Parking Spaces */}
      <Card>
        <CardHeader>
          <CardTitle>Parking Spaces</CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign parking space numbers to this residence
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter parking space number"
              value={newParkingSpace}
              onChange={(e) => setNewParkingSpace(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addParkingSpace()}
            />
            <Button
              type="button"
              onClick={addParkingSpace}
              disabled={!newParkingSpace.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {parkingSpaces.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {parkingSpaces.map((space) => (
                <Badge key={space} variant="secondary" className="flex items-center gap-1">
                  Parking {space}
                  <button
                    type="button"
                    onClick={() => removeParkingSpace(space)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No parking spaces assigned
            </p>
          )}
        </CardContent>
      </Card>

      {/* Storage Spaces */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Spaces</CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign storage space numbers to this residence
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter storage space number"
              value={newStorageSpace}
              onChange={(e) => setNewStorageSpace(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addStorageSpace()}
            />
            <Button
              type="button"
              onClick={addStorageSpace}
              disabled={!newStorageSpace.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {storageSpaces.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {storageSpaces.map((space) => (
                <Badge key={space} variant="secondary" className="flex items-center gap-1">
                  Storage {space}
                  <button
                    type="button"
                    onClick={() => removeStorageSpace(space)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No storage spaces assigned
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}