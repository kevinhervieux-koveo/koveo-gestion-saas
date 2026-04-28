import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Edit, Trash2, MapPin } from 'lucide-react';
import { Link } from 'wouter';
import { StandardCard } from '@/components/common/StandardCard';

export interface BuildingData {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: string;
  totalUnits: number;
  commonSpacesCount?: number;
  organizationId: string;
  organization_id?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildingCardProps {
  building: BuildingData;
  userRole?: string;
  onEdit?: (building: BuildingData) => void;
  onDelete?: (building: BuildingData) => void;
  t: (key: string) => string;
  showEditButtons?: boolean;
  showResidencesButton?: boolean;
  documentsPath?: string;
  residencesPath?: string;
  compact?: boolean;
}

export function BuildingCard({ 
  building, 
  userRole, 
  onEdit, 
  onDelete, 
  t,
  showEditButtons = true,
  showResidencesButton = true,
  documentsPath,
  residencesPath,
  compact = false,
}: BuildingCardProps) {
  const isAdmin = userRole === 'admin';
  const canEdit = ['admin', 'manager'].includes(userRole || '') && showEditButtons;
  
  const defaultDocumentsPath = userRole === 'admin' || userRole === 'manager' 
    ? `/manager/buildings/${building.id}/documents`
    : `/residents/building/documents?buildingId=${building.id}`;
    
  const orgId = building.organizationId || building.organization_id;
  const defaultResidencesPath = `/manager/residences?organization=${orgId}&building=${building.id}`;

  const actions = [];
  
  if (canEdit && onEdit) {
    actions.push({
      icon: <Edit className='h-3 w-3' />,
      label: 'Edit building',
      onClick: () => onEdit(building),
      variant: 'ghost' as const,
      testId: `button-edit-${building.id}`,
    });
  }
  
  if (canEdit && onDelete && isAdmin) {
    actions.push({
      icon: <Trash2 className='h-3 w-3' />,
      label: 'Delete building',
      onClick: () => onDelete(building),
      variant: 'ghost' as const,
      className: 'text-red-600 hover:text-red-700',
      testId: `button-delete-${building.id}`,
      dataOnboarding: 'building.delete-btn',
    });
  }

  const badges = compact ? [] : [
    {
      text: `${building.totalUnits} ${t('unitsCount')}`,
      variant: 'outline' as const,
    },
    ...(building.commonSpacesCount !== undefined && building.commonSpacesCount > 0 ? [{
      text: `${building.commonSpacesCount} ${t('commonSpacesCount')}`,
      variant: 'outline' as const,
    }] : []),
    {
      text: building.buildingType,
      variant: 'secondary' as const,
    },
  ];

  const metadata = compact ? [] : [
    {
      icon: <MapPin className='h-4 w-4' />,
      value: building.address,
    },
    {
      value: `${building.city}, ${building.province} ${building.postalCode}`,
    },
  ];

  const footer = (
    <div className='flex gap-2 w-full'>
      <Link href={documentsPath || defaultDocumentsPath} className="flex-1">
        <Button 
          size='sm' 
          variant='outline' 
          className='w-full'
          data-testid={`button-documents-${building.id}`}
        >
          {t('documents')}
        </Button>
      </Link>
      {showResidencesButton && (
        <Link href={residencesPath || defaultResidencesPath} className="flex-1">
          <Button 
            size='sm' 
            variant='outline' 
            className='w-full'
            data-testid={`button-residences-${building.id}`}
            data-onboarding="building.residences-tab"
          >
            {t('residences')}
          </Button>
        </Link>
      )}
    </div>
  );

  return (
    <StandardCard
      icon={<Building className='h-5 w-5 text-blue-600' />}
      title={building.name}
      badges={badges}
      metadata={metadata}
      actions={actions}
      footer={footer}
      compact={compact}
      testId={`card-building-${building.id}`}
      className='h-full'
    />
  );
}
