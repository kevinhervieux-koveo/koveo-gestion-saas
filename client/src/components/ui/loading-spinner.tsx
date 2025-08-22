import { Loader2 } from 'lucide-react';

/**
 * Loading spinner component with centered layout and animation.
 * Displays a spinning icon with loading text for async operations.
 * 
 * @returns {JSX.Element} Centered loading spinner with animation and text.
 * @example
 * ```typescript
 * function DataTable() {
 *   const { isLoading } = useQuery();
 *   
 *   if (isLoading) {
 *     return <LoadingSpinner />;
 *   }
 *   
 *   return <TableComponent />;
 * }
 * ```
 */
/**
 * LoadingSpinner function
 * @returns Function result
 */
/**
 * Loading spinner function.
 */
export function  /**
   * Loading spinner function.
   */
 LoadingSpinner() {
  return (
    <div className='flex-1 flex items-center justify-center bg-gray-50'>
      <div className='flex items-center space-x-2'>
        <Loader2 className='h-6 w-6 animate-spin text-blue-600' />
        <span className='text-sm text-gray-600'>Loading...</span>
      </div>
    </div>
  );
}
