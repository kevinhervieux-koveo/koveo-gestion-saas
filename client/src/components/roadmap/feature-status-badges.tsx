import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Circle, AlertTriangle } from 'lucide-react';

/**
 * Gets status icon for a feature.
 * @param status
 */
export function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className='w-4 h-4 text-green-600' />;
    case 'in-progress':
      return <Clock className='w-4 h-4 text-blue-600' />;
    case 'planned':
      return <Circle className='w-4 h-4 text-gray-400' />;
    default:
      return null;
  }
}

/**
 * Gets status badge for a feature.
 * @param status
 */
export function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className='bg-green-100 text-green-800 hover:bg-green-100'>Completed</Badge>;
    case 'in-progress':
      return <Badge className='bg-blue-100 text-blue-800 hover:bg-blue-100'>In Progress</Badge>;
    case 'planned':
      return <Badge className='bg-gray-100 text-gray-800 hover:bg-gray-100'>Planned</Badge>;
    default:
      return null;
  }
}

/**
 * Gets priority badge for a feature.
 * @param priority
 */
export function getPriorityBadge(priority?: string) {
  if (!priority) {
    return null;
  }
  switch (priority) {
    case 'high':
      return (
        <Badge className='bg-red-100 text-red-800 hover:bg-red-100 ml-2'>High Priority</Badge>
      );
    case 'medium':
      return (
        <Badge className='bg-yellow-100 text-yellow-800 hover:bg-yellow-100 ml-2'>Medium</Badge>
      );
    case 'low':
      return <Badge className='bg-gray-100 text-gray-600 hover:bg-gray-100 ml-2'>Low</Badge>;
    default:
      return null;
  }
}

/**
 * Gets status icon for actionable items.
 * @param status
 */
export function getActionableItemStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className='w-3 h-3 text-green-600' />;
    case 'in-progress':
      return <Clock className='w-3 h-3 text-blue-600' />;
    case 'blocked':
      return <AlertTriangle className='w-3 h-3 text-red-600' />;
    case 'pending':
    default:
      return <Circle className='w-3 h-3 text-gray-400' />;
  }
}

/**
 * Gets status badge for actionable items.
 * @param status
 */
export function getActionableItemStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className='bg-green-100 text-green-800 hover:bg-green-100 text-xs'>Done</Badge>;
    case 'in-progress':
      return <Badge className='bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs'>Working</Badge>;
    case 'blocked':
      return <Badge className='bg-red-100 text-red-800 hover:bg-red-100 text-xs'>Blocked</Badge>;
    case 'pending':
    default:
      return <Badge className='bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs'>Pending</Badge>;
  }
}