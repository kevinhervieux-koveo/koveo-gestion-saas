import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Edit, Trash2, MapPin } from 'lucide-react';
import { Link } from 'wouter';

export interface BuildingData {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: string;
  totalUnits: number;
  organizationId: string;
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
  residencesPath
}: BuildingCardProps) {
  const isAdmin = userRole === 'admin';
  const canEdit = ['admin', 'manager'].includes(userRole || '') && showEditButtons;
  
  // Default paths if not provided
  const defaultDocumentsPath = userRole === 'admin' || userRole === 'manager' 
    ? `/manager/buildings/${building.id}/documents`
    : `/residents/building/documents?buildingId=${building.id}`;
    
  const defaultResidencesPath = `/manager/residences?building=${building.id}`;

  return (
    <Card className='h-full' data-testid={`card-building-${building.id}`}>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center space-x-2'>
            <Building className='h-5 w-5 text-blue-600' />
            <CardTitle className='text-lg line-clamp-2 break-words' data-testid={`text-building-name-${building.id}`}>
              {building.name}
            </CardTitle>
          </div>
          {canEdit && onEdit && onDelete && (
            <div className='flex gap-1'>
              <Button 
                size='sm' 
                variant='ghost' 
                onClick={() => onEdit(building)}
                data-testid={`button-edit-${building.id}`}
              >
                <Edit className='h-3 w-3' />
              </Button>
              {isAdmin && (
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => onDelete(building)}
                  className='text-red-600 hover:text-red-700'
                  data-testid={`button-delete-${building.id}`}
                >
                  <Trash2 className='h-3 w-3' />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          <div className='flex items-center text-sm text-gray-600'>
            <MapPin className='h-4 w-4 mr-2' />
            <span className='line-clamp-2 break-words flex-1' data-testid={`text-building-address-${building.id}`}>
              {building.address}
            </span>
          </div>
          <div className='flex items-center text-sm text-gray-600'>
            <span data-testid={`text-building-location-${building.id}`}>
              {building.city}, {building.province} {building.postalCode}
            </span>
          </div>
          <div className='flex items-center justify-between pt-2'>
            <Badge variant='outline' data-testid={`badge-units-${building.id}`}>
              {building.totalUnits} {t('unitsCount')}
            </Badge>
            <Badge variant='secondary' data-testid={`badge-type-${building.id}`}>
              {building.buildingType}
            </Badge>
          </div>
          <div className='pt-2 flex gap-2'>
            <Link href={documentsPath || defaultDocumentsPath}>
              <Button 
                size='sm' 
                variant='outline' 
                className='flex-1'
                data-testid={`button-documents-${building.id}`}
              >
                Documents
              </Button>
            </Link>
            {showResidencesButton && (
              <Link href={residencesPath || defaultResidencesPath}>
                <Button 
                  size='sm' 
                  variant='outline' 
                  className='flex-1'
                  data-testid={`button-residences-${building.id}`}
                >
                  Residences
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}