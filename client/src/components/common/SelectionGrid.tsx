import { Building, Home, Users, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { NoDataCard } from '@/components/ui/no-data-card';
import { useLanguage } from '@/hooks/use-language';

/**
 * Item type for selection grid
 */
export interface SelectionGridItem {
  id: string;
  name: string;
  details: string;
  type: 'organization' | 'building' | 'residence';
}

/**
 * Props for SelectionGrid component
 */
interface SelectionGridProps {
  /**
   * Title to display above the grid
   */
  title: string;
  
  /**
   * Array of items to display as cards
   */
  items: SelectionGridItem[];
  
  /**
   * Callback when an item is selected
   */
  onSelectItem: (id: string) => void;
  
  /**
   * Optional callback for back navigation
   */
  onBack: (() => void) | null;
  
  /**
   * Loading state flag
   */
  isLoading: boolean;
}

/**
 * Get appropriate icon for item type
 */
function getIconForType(type: SelectionGridItem['type']) {
  switch (type) {
    case 'organization':
      return Users;
    case 'building':
      return Building;
    case 'residence':
      return Home;
    default:
      return Building;
  }
}

/**
 * SelectionGrid component - displays a grid of selectable cards for hierarchical navigation
 * Used for Organization → Building → Residence selection flows
 */
export function SelectionGrid({ 
  title, 
  items, 
  onSelectItem, 
  onBack, 
  isLoading 
}: SelectionGridProps) {
  const { t } = useLanguage();

  // Show loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Show no data state
  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {onBack && (
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900" data-testid="selection-title">
              {title}
            </h2>
            <Button
              variant="outline"
              onClick={onBack}
              className="flex items-center gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('back' as any)}
            </Button>
          </div>
        )}
        
        <NoDataCard
          icon={Building}
          titleKey="noItemsFound"
          descriptionKey="noItemsMessage"
          badgeKey="noData"
          testId="no-items-message"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with title and optional back button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900" data-testid="selection-title">
          {title}
        </h2>
        
        {onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back' as any)}
          </Button>
        )}
      </div>

      {/* Grid of selection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const Icon = getIconForType(item.type);
          
          return (
            <Card 
              key={item.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              data-testid={`card-${item.type}-${item.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg" data-testid={`text-name-${item.id}`}>
                    {item.name}
                  </CardTitle>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p 
                  className="text-sm text-gray-600" 
                  data-testid={`text-details-${item.id}`}
                >
                  {item.details}
                </p>
                
                <Button
                  onClick={() => {
                    console.log('🎯 [SELECTION GRID DEBUG] Button clicked:', { itemId: item.id, itemName: item.name });
                    onSelectItem(item.id);
                  }}
                  className="w-full"
                  data-testid={`button-select-${item.id}`}
                >
                  {t('select' as any)}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}