import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Building,
  MapPin,
  Calendar,
  Users,
  Car,
  Package,
  Edit3,
  Trash2,
  FileText,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { BuildingData } from './types';

/**
 * Interface for BuildingCard component props.
 */
interface BuildingCardProps {
  building: BuildingData;
  userRole?: string;
  onEdit: (_building: BuildingData) => void;
  onDelete: (_building: BuildingData) => void;
}

/**
 * Building card component for displaying building information.
 * @param root0 - Building card component props.
 * @param root0.building - Building data to display.
 * @param root0.userRole - Current user's role for permission checking.
 * @param root0.onEdit - Callback function when edit button is clicked.
 * @param root0.onDelete - Callback function when delete button is clicked.
 * @returns JSX element for the building card.
 */
/**
 * BuildingCard function.
 * @param root0
 * @param root0.building
 * @param root0.userRole
 * @param root0.onEdit
 * @param root0.onDelete
 * @returns Function result.
 */
export function BuildingCard({ building, userRole, onEdit, onDelete }: BuildingCardProps) {
  const [, navigate] = useLocation();

  return (
    <Card className='h-full'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex-1 min-w-0 mr-4'>
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle
                  className='text-lg font-semibold text-gray-900 mb-1 truncate cursor-help'
                  title={building.name}
                >
                  {building.name}
                </CardTitle>
              </TooltipTrigger>
              <TooltipContent>
                <p className='max-w-xs'>{building.name}</p>
              </TooltipContent>
            </Tooltip>
            <p className='text-sm text-gray-600 mt-1'>{building.organizationName}</p>
          </div>
          <div className='flex items-center gap-2'>
            <div className='flex gap-2'>
              <Badge variant={building.buildingType === 'condo' ? 'default' : 'secondary'}>
                {building.buildingType === 'condo' ? 'Condo' : 'Appartement'}
              </Badge>
              <Badge variant='outline'>
                {building.accessType === 'organization' ? 'Organization' : 'Residence'}
              </Badge>
            </div>
            {(userRole === 'admin' || userRole === 'manager') && (
              <div className='flex gap-1 ml-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => navigate(`/manager/buildings/documents?buildingId=${building.id}`)}
                  className='h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                  title='Manage building documents'
                >
                  <FileText className='w-4 h-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => onEdit(building)}
                  className='h-8 w-8 p-0'
                  title='Edit building'
                >
                  <Edit3 className='w-4 h-4' />
                </Button>
                {userRole === 'admin' && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => onDelete(building)}
                    className='h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50'
                    title='Delete building'
                  >
                    <Trash2 className='w-4 h-4' />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='grid md:grid-cols-2 gap-4'>
          {/* Address Information */}
          <div className='space-y-3'>
            <div className='flex items-center gap-2'>
              <MapPin className='w-4 h-4 text-gray-500' />
              <div>
                <p className='text-sm font-medium'>{building.address}</p>
                <p className='text-xs text-gray-500'>
                  {building.city}, {building.province} {building.postalCode}
                </p>
              </div>
            </div>

            {building.yearBuilt && (
              <div className='flex items-center gap-2'>
                <Calendar className='w-4 h-4 text-gray-500' />
                <span className='text-sm'>Built in {building.yearBuilt}</span>
              </div>
            )}

            {building.managementCompany && (
              <div className='flex items-center gap-2'>
                <Building className='w-4 h-4 text-gray-500' />
                <span className='text-sm'>Managed by {building.managementCompany}</span>
              </div>
            )}
          </div>

          {/* Building Statistics */}
          <div className='space-y-3'>
            <div className='flex items-center gap-2'>
              <Users className='w-4 h-4 text-gray-500' />
              <span className='text-sm'>{building.totalUnits} units</span>
              {building.totalFloors && (
                <span className='text-xs text-gray-500'>• {building.totalFloors} floors</span>
              )}
            </div>

            {building.parkingSpaces !== null && building.parkingSpaces !== undefined && (
              <div className='flex items-center gap-2'>
                <Car className='w-4 h-4 text-gray-500' />
                <span className='text-sm'>{building.parkingSpaces} parking spaces</span>
              </div>
            )}

            {building.storageSpaces !== null && building.storageSpaces !== undefined && (
              <div className='flex items-center gap-2'>
                <Package className='w-4 h-4 text-gray-500' />
                <span className='text-sm'>{building.storageSpaces} storage spaces</span>
              </div>
            )}
          </div>
        </div>

        {/* Amenities */}
        {building.amenities && building.amenities.length > 0 && (
          <div className='mt-4 pt-4 border-t'>
            <p className='text-sm font-medium mb-2'>Amenities:</p>
            <div className='flex flex-wrap gap-1'>
              {building.amenities.map((amenity, _index) => (
                <Badge key={_index} variant='outline' className='text-xs'>
                  {amenity}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
