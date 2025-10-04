import { useState } from 'react';
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
import { StandardCard } from '@/components/common/StandardCard';

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
  compact?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function ResidenceCard({
  residence,
  onRefresh,
  onDocumentsClick,
  showEditDialog = true,
  compact = false,
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

  const statusBadgeVariant = residence.isActive ? 'default' : 'secondary';
  const badges = compact ? [] : [
    {
      text: residence.isActive ? t('active') : t('inactive'),
      variant: statusBadgeVariant as 'default' | 'secondary',
    },
  ];

  const buildingInfo = (
    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
      <p className='flex items-center gap-1 min-w-0'>
        <Building className='w-3 h-3 flex-shrink-0' />
        <span className='truncate'>{residence.building.name}</span>
      </p>
      <p className='flex items-center gap-1'>
        <MapPin className='w-3 h-3 flex-shrink-0' />
        {t('floor')} {residence.floor || 'N/A'}
      </p>
    </div>
  );

  const metadata = compact ? [] : [
    ...(residence.bedrooms ? [{
      icon: <Bed className='w-3 h-3' />,
      value: `${residence.bedrooms || 0} ${t('bed')}`,
    }] : []),
    ...(residence.bathrooms ? [{
      icon: <Bath className='w-3 h-3' />,
      value: `${residence.bathrooms || 0} ${t('bath')}`,
    }] : []),
    ...(residence.squareFootage ? [{
      value: `${residence.squareFootage} ${t('sqFt')}`,
    }] : []),
    ...(residence.parkingSpaceNumbers?.length > 0 ? [{
      icon: <Car className='w-3 h-3' />,
      value: `${t('parking')}: ${residence.parkingSpaceNumbers.join(', ')}`,
    }] : []),
    ...(residence.storageSpaceNumbers?.length > 0 ? [{
      icon: <Package className='w-3 h-3' />,
      value: `${t('storage')}: ${residence.storageSpaceNumbers.join(', ')}`,
    }] : []),
    ...(residence.monthlyFees ? [{
      value: `$${residence.monthlyFees}/${t('monthShort')}`,
    }] : []),
  ];

  const actions = [];
  
  const content = !compact ? (
    <div className='space-y-4'>
      {buildingInfo}
      
      <div>
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
              <p key={tenant.id} className='text-xs text-gray-600 truncate'>
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
    </div>
  ) : null;

  const footer = (
    <div className='flex gap-2 w-full'>
      <Button
        variant='outline'
        size='sm'
        className='flex-1'
        onClick={handleDocumentsClick}
        title={t('manageResidenceDocuments')}
        data-testid={`button-documents-${residence.id}`}
      >
        <FileText className='w-3 h-3 mr-1' />
        {t('documentsButton')}
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
              {t('edit')}
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
  );

  return (
    <StandardCard
      icon={<Home className='w-4 h-4' />}
      title={`${t('unitNumber')} ${residence.unitNumber}`}
      badges={badges}
      metadata={metadata}
      actions={actions}
      footer={footer}
      compact={compact}
      testId={testId}
      className={className}
    >
      {content}
    </StandardCard>
  );
}

export default ResidenceCard;
