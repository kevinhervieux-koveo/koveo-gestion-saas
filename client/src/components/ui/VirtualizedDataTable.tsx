import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type Row,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useComponentPerformance } from '@/utils/component-complexity-analyzer';

interface VirtualizedDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  title?: string;
  description?: string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  enableVirtualization?: boolean;
  itemHeight?: number;
  maxHeight?: number;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  emptyState?: {
    title: string;
    description: string;
    icon?: React.ComponentType<{ className?: string }>;
  };
  className?: string;
  onRowClick?: (row: Row<TData>) => void;
  getRowId?: (row: TData, index: number) => string;
}

// Memoized row component for performance
const VirtualizedRow = React.memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    rows: Row<any>[];
    columns: ColumnDef<any, any>[];
    onRowClick?: (row: Row<any>) => void;
  };
}>(({ index, style, data }) => {
  const { rows, columns, onRowClick } = data;
  const row = rows[index];

  const handleRowClick = useCallback(() => {
    onRowClick?.(row);
  }, [onRowClick, row]);

  return (
    <div style={style}>
      <TableRow
        onClick={handleRowClick}
        className={onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
        data-testid={`row-${index}`}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id} className="px-4 py-2">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    </div>
  );
});

VirtualizedRow.displayName = 'VirtualizedRow';

/**
 * High-performance virtualized data table for large datasets
 * Uses react-window for efficient rendering of large lists
 */
export const VirtualizedDataTable = React.memo(<TData, TValue>({
  columns,
  data,
  title,
  description,
  isLoading = false,
  searchPlaceholder = "Search...",
  enableVirtualization = true,
  itemHeight = 50,
  maxHeight = 400,
  enableFiltering = true,
  enableSorting = true,
  enablePagination = false, // Virtualization typically replaces pagination
  pageSize = 50,
  emptyState,
  className,
  onRowClick,
  getRowId,
}: VirtualizedDataTableProps<TData, TValue>) => {
  useComponentPerformance('VirtualizedDataTable');
  
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const listRef = useRef<List>(null);

  // Memoized table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getRowId,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      ...(enablePagination && { pagination: { pageIndex: 0, pageSize } })
    },
  });

  // Memoized filtered rows for performance
  const filteredRows = useMemo(() => {
    return table.getRowModel().rows;
  }, [table]);

  // Memoized row data for virtualization
  const rowVirtualizerData = useMemo(() => ({
    rows: filteredRows,
    columns,
    onRowClick,
  }), [filteredRows, columns, onRowClick]);

  // Debounced global filter to improve performance
  const debouncedSetGlobalFilter = useCallback(
    debounce((value: string) => {
      setGlobalFilter(value);
    }, 300),
    []
  );

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetGlobalFilter(event.target.value);
  }, [debouncedSetGlobalFilter]);

  // Scroll to top when data changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, [filteredRows]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0 && !isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          {emptyState?.icon && <emptyState.icon className="h-12 w-12 text-gray-400 mb-4" />}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {emptyState?.title || 'No data available'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
            {emptyState?.description || 'There are no items to display at this time.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="virtualized-data-table">
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>}
        </CardHeader>
      )}
      
      <CardContent>
        {/* Search and Controls */}
        {enableFiltering && (
          <div className="flex items-center py-4">
            <Input
              placeholder={searchPlaceholder}
              onChange={handleSearchChange}
              className="max-w-sm"
              data-testid="search-input"
            />
            <div className="ml-auto text-sm text-gray-500">
              Showing {filteredRows.length} of {data.length} items
            </div>
          </div>
        )}

        {/* Table Header */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="px-4 py-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
          </Table>

          {/* Virtualized Table Body */}
          {enableVirtualization && filteredRows.length > 20 ? (
            <div style={{ height: Math.min(maxHeight, filteredRows.length * itemHeight) }}>
              <List
                ref={listRef}
                height={Math.min(maxHeight, filteredRows.length * itemHeight)}
                itemCount={filteredRows.length}
                itemSize={itemHeight}
                itemData={rowVirtualizerData}
                overscanCount={5} // Render 5 extra items for smooth scrolling
              >
                {VirtualizedRow}
              </List>
            </div>
          ) : (
            // Fallback to regular table for smaller datasets
            <Table>
              <TableBody>
                {filteredRows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
                    data-testid={`row-${index}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Performance Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs text-blue-700 dark:text-blue-300">
            Performance: {enableVirtualization && filteredRows.length > 20 
              ? `Virtualized (${filteredRows.length} items, rendering ~${Math.ceil(maxHeight / itemHeight)} visible)`
              : `Standard rendering (${filteredRows.length} items)`
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
});

VirtualizedDataTable.displayName = 'VirtualizedDataTable';

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

export default VirtualizedDataTable;