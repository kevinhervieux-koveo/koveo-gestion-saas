import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Home,
  Edit,
  Users,
  Building,
  MapPin,
  Car,
  Package,
  Bed,
  Bath,
  FileText,
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { ResidenceEditForm } from '@/components/forms/residence-edit-form';

/**
 * Residence interface - matches the structure from residences.tsx
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
    address: string;
    city: string;
  };
  organization: {
    id: string;
    name: string;
  };
  tenants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

interface ResidenceCardProps {
  residence: Residence;
  onRefresh?: () => void;
  onDocumentsClick?: (residenceId: string) => void;
  showEditDialog?: boolean;
  className?: string;
  'data-testid'?: string;
}

/**
 * ResidenceCard - Reusable card component for displaying residence information
 * Extracted from manager/residences.tsx to eliminate duplication and improve maintainability
 */
export function ResidenceCard({
  residence,
  onRefresh,
  onDocumentsClick,
  showEditDialog = true,
  className = '',
  'data-testid': testId = `residence-card-${residence.id}`,
}: ResidenceCardProps) {
  const { t } = useLanguage();
  const [editingResidence, setEditingResidence] = useState<Residence | null>(null);

  const handleDocumentsClick = () => {
    if (onDocumentsClick) {
      onDocumentsClick(residence.id);
    }
  };

  const handleEditSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
    setEditingResidence(null);
  };

  return (
    <>
      <Card className={`hover:shadow-lg transition-shadow ${className}`} data-testid={testId}>
        <CardContent className='p-6'>
          <div className='flex justify-between items-start mb-4'>
            <div>
              <h3 className='font-semibold text-lg flex items-center gap-2'>
                <Home className='w-4 h-4' />
                {t('unitNumber')} {residence.unitNumber}
              </h3>
              <p className='text-sm text-gray-600 flex items-center gap-1'>
                <Building className='w-3 h-3' />
                {residence.building.name}
              </p>
              <p className='text-xs text-gray-500 flex items-center gap-1'>
                <MapPin className='w-3 h-3' />
                {t('floor')} {residence.floor || 'N/A'}
              </p>
            </div>
            <Badge 
              variant={residence.isActive ? 'default' : 'secondary'}
              data-testid={`badge-status-${residence.id}`}
            >
              {residence.isActive ? t('active') : t('inactive')}
            </Badge>
          </div>

          {/* Unit Details */}
          <div className='space-y-2 mb-4'>
            <div className='flex items-center gap-4 text-sm'>
              <span className='flex items-center gap-1' data-testid={`bedrooms-${residence.id}`}>
                <Bed className='w-3 h-3' />
                {residence.bedrooms || 0} {t('bed')}
              </span>
              <span className='flex items-center gap-1' data-testid={`bathrooms-${residence.id}`}>
                <Bath className='w-3 h-3' />
                {residence.bathrooms || 0} {t('bath')}
              </span>
            </div>

            {residence.squareFootage && (
              <p className='text-sm text-gray-600' data-testid={`square-footage-${residence.id}`}>
                {residence.squareFootage} {t('sqFt')}
              </p>
            )}

            {residence.parkingSpaceNumbers?.length > 0 && (
              <p className='text-sm text-gray-600 flex items-center gap-1' data-testid={`parking-${residence.id}`}>
                <Car className='w-3 h-3' />
                {t('parking')}: {residence.parkingSpaceNumbers.join(', ')}
              </p>
            )}

            {residence.storageSpaceNumbers?.length > 0 && (
              <p className='text-sm text-gray-600 flex items-center gap-1' data-testid={`storage-${residence.id}`}>
                <Package className='w-3 h-3' />
                {t('storage')}: {residence.storageSpaceNumbers.join(', ')}
              </p>
            )}

            {residence.monthlyFees && (
              <p className='text-sm font-medium text-green-600' data-testid={`monthly-fees-${residence.id}`}>
                ${residence.monthlyFees}/{t('monthShort')}
              </p>
            )}
          </div>

          {/* Tenants */}
          <div className='mb-4'>
            <h4 className='text-sm font-medium mb-2 flex items-center gap-1'>
              <Users className='w-3 h-3' />
              {t('residents')} ({residence.tenants.length})
            </h4>
            {residence.tenants.length === 0 ? (
              <p className='text-xs text-gray-500' data-testid={`no-residents-${residence.id}`}>
                {t('noResidentsAssigned')}
              </p>
            ) : (
              <div className='space-y-1' data-testid={`tenants-list-${residence.id}`}>
                {residence.tenants.slice(0, 2).map((tenant) => (
                  <p key={tenant.id} className='text-xs text-gray-600'>
                    {tenant.firstName} {tenant.lastName}
                  </p>
                ))}
                {residence.tenants.length > 2 && (
                  <p className='text-xs text-gray-500'>
                    +{residence.tenants.length - 2} {t('moreResidents')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='flex-1'
              onClick={handleDocumentsClick}
              title={t('manageResidenceDocuments')}
              data-testid={`button-documents-${residence.id}`}
            >
              <FileText className='w-3 h-3 mr-1' />
              {t('residenceDocumentsButton')}
            </Button>
            
            {showEditDialog && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    className='flex-1'
                    onClick={() => setEditingResidence(residence)}
                    data-testid={`button-edit-${residence.id}`}
                  >
                    <Edit className='w-3 h-3 mr-1' />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                  <DialogHeader>
                    <DialogTitle>Edit Unit {residence.unitNumber}</DialogTitle>
                  </DialogHeader>
                  {editingResidence && (
                    <ResidenceEditForm
                      residence={editingResidence}
                      onSuccess={handleEditSuccess}
                    />
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default ResidenceCard;