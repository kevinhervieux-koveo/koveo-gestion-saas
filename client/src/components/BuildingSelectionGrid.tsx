import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building as BuildingIcon } from 'lucide-react';
import type { Building } from '@shared/schema';

// Building selection grid component
/**
 * @param root0
 * @param root0.buildings
 * @param root0.onBuildingSelect
 */
/**
 * BuildingSelectionGrid function.
 * @param root0
 * @param root0.buildings
 * @param root0.onBuildingSelect
 * @returns Function result.
 */
export function BuildingSelectionGrid({ 
  buildings, 
  onBuildingSelect 
}: { 
  buildings: Building[]; 
  onBuildingSelect: (buildingId: string) => void;
}) {
  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <BuildingIcon className='w-5 h-5' />
            Select a Building
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-gray-600 mb-6'>Choose a building to view and manage its bills</p>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {buildings.map((building) => (
              <BuildingCard 
                key={building.id} 
                building={building} 
                onSelect={() => onBuildingSelect(building.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Building card component
/**
 * @param root0
 * @param root0.building
 * @param root0.onSelect
 */
/**
 * BuildingCard function.
 * @param root0
 * @param root0.building
 * @param root0.onSelect
 * @returns Function result.
 */
function BuildingCard({ 
  building, 
  onSelect 
}: { 
  building: Building; 
  onSelect: () => void;
}) {
  return (
    <Card 
      className='hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-blue-300 group'
      onClick={onSelect}
    >
      <CardContent className='p-6'>
        <div className='space-y-4'>
          <div className='flex items-start justify-between'>
            <div className='flex-1'>
              <h3 className='font-semibold text-lg group-hover:text-blue-600 transition-colors'>
                {building.name}
              </h3>
              <p className='text-sm text-gray-500 mt-1'>
                {building.address}
              </p>
              {building.city && (
                <p className='text-sm text-gray-500'>
                  {building.city}
                </p>
              )}
            </div>
            <BuildingIcon className='w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors' />
          </div>
          
          <div className='flex items-center justify-between text-sm'>
            <div className='flex items-center gap-4'>
              {building.buildingType && (
                <Badge variant='outline' className='text-xs'>
                  {building.buildingType.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>
          
          <div className='pt-2 border-t border-gray-100'>
            <Button 
              variant='outline' 
              size='sm' 
              className='w-full group-hover:bg-blue-50 group-hover:border-blue-300'
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              View Bills
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}