import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 *
 */
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
  showInfo?: boolean;
}

/**
 * Reusable pagination controls component
 * Handles page navigation with proper disabled states and page info.
 * @param root0
 * @param root0.currentPage
 * @param root0.totalPages
 * @param root0.totalItems
 * @param root0.itemsPerPage
 * @param root0.onPageChange
 * @param root0.className
 * @param root0.showInfo
 */
export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = '',
  showInfo = true
}: PaginationControlsProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getVisiblePages = () => {
    const maxVisiblePages = 5;
    const pages: number[] = [];

    if (totalPages <= maxVisiblePages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show subset of pages around current page
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        startPage = 1;
        endPage = maxVisiblePages;
      }
      
      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        startPage = totalPages - maxVisiblePages + 1;
        endPage = totalPages;
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  // Don't render if there's only one page or no items
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Pagination Controls */}
      <div className='flex items-center justify-center gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          data-testid="button-previous-page"
        >
          <ChevronLeft className='h-4 w-4 mr-1' />
          Previous
        </Button>
        
        <div className='flex gap-1'>
          {getVisiblePages().map((pageNum) => (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'default' : 'outline'}
              size='sm'
              onClick={() => onPageChange(pageNum)}
              className="w-10 h-9 p-0"
              data-testid={`button-page-${pageNum}`}
            >
              {pageNum}
            </Button>
          ))}
        </div>
        
        <Button
          variant='outline'
          size='sm'
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          data-testid="button-next-page"
        >
          Next
          <ChevronRight className='h-4 w-4 ml-1' />
        </Button>
      </div>

      {/* Page Info */}
      {showInfo && totalItems > 0 && (
        <div className='text-center text-sm text-muted-foreground' data-testid="pagination-info">
          Showing {startItem} to {endItem} of {totalItems} items
        </div>
      )}
    </div>
  );
}

export default PaginationControls;