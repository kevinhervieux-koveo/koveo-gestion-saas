import { useState, useCallback } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  Search, 
  Settings2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X
} from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  title?: string;
  description?: string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchableColumn?: string;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableColumnVisibility?: boolean;
  enablePagination?: boolean;
  enableRowSelection?: boolean;
  pageSize?: number;
  emptyState?: {
    title: string;
    description: string;
    icon?: React.ComponentType<{ className?: string }>;
  };
  className?: string;
  renderRowActions?: (row: Row<TData>) => React.ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  getRowId?: (row: TData) => string;
}

/**
 * Generic DataTable component for maintenance journal system
 * Provides sorting, filtering, pagination, and responsive design
 * with proper loading states and accessibility
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  title,
  description,
  isLoading = false,
  searchPlaceholder = "Search...",
  searchableColumn,
  enableFiltering = true,
  enableSorting = true,
  enableColumnVisibility = true,
  enablePagination = true,
  enableRowSelection = false,
  pageSize = 10,
  emptyState,
  className,
  renderRowActions,
  onRowClick,
  rowSelection,
  onRowSelectionChange,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

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
    enableRowSelection: enableRowSelection,
    onRowSelectionChange: onRowSelectionChange,
    getRowId: getRowId,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      ...(enableRowSelection && rowSelection !== undefined ? { rowSelection } : {}),
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const handleSearchChange = useCallback((value: string) => {
    if (searchableColumn) {
      table.getColumn(searchableColumn)?.setFilterValue(value);
    } else {
      setGlobalFilter(value);
    }
  }, [table, searchableColumn]);

  const clearFilters = useCallback(() => {
    setGlobalFilter("");
    setColumnFilters([]);
  }, []);

  const getSortIcon = (isSorted: false | "asc" | "desc") => {
    if (isSorted === "asc") return <ArrowUp className="h-4 w-4" />;
    if (isSorted === "desc") return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
  };

  const LoadingSkeleton = () => (
    <TableBody>
      {Array.from({ length: pageSize }).map((_, index) => (
        <TableRow key={index} data-testid={`skeleton-row-${index}`}>
          {columns.map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-6 w-full" />
            </TableCell>
          ))}
          {renderRowActions && (
            <TableCell>
              <Skeleton className="h-8 w-8 rounded" />
            </TableCell>
          )}
        </TableRow>
      ))}
    </TableBody>
  );

  const EmptyState = () => {
    const IconComponent = emptyState?.icon;
    
    return (
      <TableBody>
        <TableRow>
          <TableCell 
            colSpan={columns.length + (renderRowActions ? 1 : 0)} 
            className="h-64 text-center"
          >
            <div className="flex flex-col items-center justify-center py-8" data-testid="empty-state">
              {IconComponent && (
                <IconComponent className="h-12 w-12 text-muted-foreground mb-4" />
              )}
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                {emptyState?.title || "No data available"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {emptyState?.description || "There are no items to display."}
              </p>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  };

  const hasActiveFilters = globalFilter !== "" || columnFilters.length > 0;

  return (
    <Card className={className} data-testid="data-table">
      {(title || description) && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              {title && <CardTitle data-testid="table-title">{title}</CardTitle>}
              {description && (
                <p className="text-sm text-muted-foreground mt-1" data-testid="table-description">
                  {description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      )}
      
      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        {enableFiltering && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchableColumn 
                    ? (table.getColumn(searchableColumn)?.getFilterValue() as string) ?? ""
                    : globalFilter
                  }
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
              
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="px-2"
                  data-testid="clear-filters-button"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {hasActiveFilters && (
                <Badge variant="secondary" data-testid="active-filters-badge">
                  <Filter className="h-3 w-3 mr-1" />
                  {columnFilters.length + (globalFilter ? 1 : 0)} filter(s)
                </Badge>
              )}
              
              {enableColumnVisibility && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="ml-auto"
                      data-testid="column-visibility-button"
                    >
                      <Settings2 className="h-4 w-4 mr-2" />
                      Columns
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" data-testid="column-visibility-menu">
                    {table
                      .getAllColumns()
                      .filter((column) => column.getCanHide())
                      .map((column) => {
                        return (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            className="capitalize"
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) =>
                              column.toggleVisibility(!!value)
                            }
                            data-testid={`column-toggle-${column.id}`}
                          >
                            {column.id}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const isSorted = header.column.getIsSorted();
                    
                    return (
                      <TableHead 
                        key={header.id}
                        className="font-medium"
                        data-testid={`column-header-${header.id}`}
                      >
                        {header.isPlaceholder ? null : (
                          <div className={canSort ? "flex items-center space-x-2" : ""}>
                            {canSort ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="-ml-3 h-8 data-[state=open]:bg-accent"
                                onClick={() => header.column.toggleSorting()}
                                data-testid={`sort-button-${header.id}`}
                              >
                                <span>
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                                </span>
                                {getSortIcon(isSorted)}
                              </Button>
                            ) : (
                              flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )
                            )}
                          </div>
                        )}
                      </TableHead>
                    );
                  })}
                  {renderRowActions && (
                    <TableHead className="text-right w-20">Actions</TableHead>
                  )}
                </TableRow>
              ))}
            </TableHeader>

            {isLoading ? (
              <LoadingSkeleton />
            ) : table.getRowModel().rows?.length ? (
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    data-testid={`table-row-${row.id}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell 
                        key={cell.id}
                        data-testid={`table-cell-${cell.column.id}-${row.id}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                    {renderRowActions && (
                      <TableCell className="text-right">
                        {renderRowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            ) : (
              <EmptyState />
            )}
          </Table>
        </div>

        {/* Pagination */}
        {enablePagination && !isLoading && table.getRowModel().rows?.length > 0 && (
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground" data-testid="pagination-info">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{" "}
              of {table.getFilteredRowModel().rows.length} result(s)
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                data-testid="first-page-button"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                data-testid="previous-page-button"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                data-testid="next-page-button"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                data-testid="last-page-button"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type { DataTableProps };