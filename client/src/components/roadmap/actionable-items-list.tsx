import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getActionableItemStatusIcon, getActionableItemStatusBadge } from './feature-status-badges';
import type { ActionableItem } from '@shared/schema';

/**
 * Props for ActionableItemsList component.
 */
interface ActionableItemsListProps {
  featureId: string;
  items: ActionableItem[];
  onToggleStatus: (item: ActionableItem) => void;
  onFetchItems: (featureId: string) => void;
}

/**
 * Component for displaying and managing actionable items for a feature.
 * @param root0
 * @param root0.featureId
 * @param root0.items
 * @param root0.onToggleStatus
 * @param root0.onFetchItems
 */
/**
 * ActionableItemsList function.
 * @param root0
 * @param root0.featureId
 * @param root0.items
 * @param root0.onToggleStatus
 * @param root0.onFetchItems
 * @returns Function result.
 */
export function ActionableItemsList({
  featureId,
  items,
  onToggleStatus,
  onFetchItems,
}: ActionableItemsListProps) {
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!hasLoaded && items.length === 0) {
      onFetchItems(featureId);
      setHasLoaded(true);
    }
  }, [featureId, items.length, hasLoaded, onFetchItems]);

  if (items.length === 0) {
    return <div className='text-sm text-gray-500 italic ml-6'>No actionable items yet</div>;
  }

  return (
    <div className='ml-6 mt-2 space-y-2'>
      {items.map((item) => (
        <div
          key={item.id}
          className='flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors'
        >
          <div className='flex items-center gap-2 flex-1'>
            {getActionableItemStatusIcon(item.status)}
            <span className='text-sm'>{item.title}</span>
            {getActionableItemStatusBadge(item.status)}
          </div>
          <Button
            size='sm'
            variant={item.status === 'completed' ? 'secondary' : 'default'}
            onClick={() => onToggleStatus(item)}
            className='ml-2'
          >
            {item.status === 'completed' ? 'Mark Pending' : 'Mark Done'}
          </Button>
        </div>
      ))}
    </div>
  );
}
