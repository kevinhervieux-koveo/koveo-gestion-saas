import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardCard } from '@/components/ui/standard-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building as BuildingIcon } from 'lucide-react';
import type { Building } from '@shared/schema';

/**
 * Building selection grid component.
 * @param root0 - Component props.
 * @param root0.buildings - Array of buildings to display.
 * @param root0.onBuildingSelect - Callback when building is selected.
 * @returns Building selection grid JSX.
 */
/**
 * BuildingSelectionGrid component.
 * @param props - Component props.
 * @param props.buildings - Buildings parameter.
 * @param props.onBuildingSelect - OnBuildingSelect parameter.
 * @returns JSX element.
 */
/**
 * BuildingSelectionGrid component.
 * @param props - Component props.
 * @param props.buildings - Buildings parameter.
 * @param props.onBuildingSelect - OnBuildingSelect parameter.
 * @returns JSX element.
 */
/**
 * BuildingSelectionGrid component.
 * @param props - Component props.
 * @param props.buildings - buildings parameter.
 * @param props.onBuildingSelect - onBuildingSelect parameter.
 * @returns JSX element.
 */
/**
 * BuildingSelectionGrid component.
 * @param props - Component props.
 * @param props.buildings - buildings parameter.
 * @param props.onBuildingSelect - onBuildingSelect parameter.
 * @returns JSX element.
 */
/**
 * BuildingSelectionGrid component.
 * @param props - Component props.
 * @param props.buildings - buildings parameter.
 * @param props.onBuildingSelect - onBuildingSelect parameter.
 * @returns JSX element.
 */
export function BuildingSelectionGrid({
  buildings,
  onBuildingSelect,
}: {
  buildings: Building[];
  onBuildingSelect: (_buildingId: string) => void;
}) {
  return (
    <div className='space-y-6'>
      <StandardCard 
        title="Select a Building"
        headerClassName="flex items-center gap-2"
      >
        <BuildingIcon className='w-5 h-5 mr-2' />
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
      </StandardCard>
    </div>
  );
}

/**
 * Individual building card component.
 * @param root0 - Component props.
 * @param root0.building - Building data to display.
 * @param root0.onSelect - Callback when card is selected.
 * @returns Building card JSX.
 */
function BuildingCard({ building, onSelect }: { building: Building; onSelect: () => void }) {
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
              <p className='text-sm text-gray-500 mt-1'>{building.address}</p>
              {building.city && <p className='text-sm text-gray-500'>{building.city}</p>}
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
