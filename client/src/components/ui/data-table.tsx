import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

/*
 * Column configuration for the data table

/*
 * ColumnConfig type definition.

/*
 * ColumnConfig type definition.

export interface ColumnConfig<T> extends TableColumn<T> {}

/*
 * TableColumn type definition.

/*
 * TableColumn type definition.

export interface TableColumn<T> {
  _key: string;
  label: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  sortable?: boolean;
  width?: string;
  className?: string;
  render?: (_value: unknown, _item: T) => React.ReactNode;
  hideOnMobile?: boolean;
}

/*
 * Action configuration for table rows

/*
 * TableAction type definition.

/*
 * TableAction type definition.

export interface TableAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (_item: T) => void;
  disabled?: (_item: T) => boolean;
  variant?: 'default' | 'destructive';
  separator?: boolean;
}

/*
 * Bulk action configuration

/*
 * BulkAction type definition.

/*
 * BulkAction type definition.

export interface BulkAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (_items: T[]) => void;
  variant?: 'default' | 'destructive';
}

/*
 * Props for the DataTable component

interface DataTableProps<T> {
  _data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  bulkActions?: BulkAction<T>[];
  keyAccessor: keyof T;
  title?: string;
  selectable?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  onSelectionChange?: (_selection: Set<string>) => void;
  selectedItems?: Set<string>;
}

/*
 * Reusable Data Table Component
 * 
 * Provides standardized table functionality with selection, actions,
 * responsive design, and bulk operations to reduce table code duplication.
 * 
 * @param props - Table configuration and data
 * @returns Standardized data table component

/*
 * DataTable function
 * @returns Function result

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  actions = [],
  bulkActions = [],
  keyAccessor,
  title,
  selectable = false,
  isLoading = false,
  emptyMessage,
  className = '',
  onSelectionChange,
  selectedItems = new Set()
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const [internalSelection, setInternalSelection] = useState<Set<string>>(new Set());
  
  const selection = selectedItems.size > 0 ? selectedItems : internalSelection;
  const setSelection = onSelectionChange || setInternalSelection;

  const handleSelectAll = (checked: boolean) => {








    if (checked) {
      const newSelection = new Set(data.map(item => String(item[keyAccessor])));
      setSelection(newSelection);
    } else {
      setSelection(new Set());
    }
  };

  const handleItemSelection = (itemKey: string, checked: boolean) => {
    const newSelection = new Set(selection);
    if (checked) {
      newSelection.add(itemKey);
    } else {
      newSelection.delete(itemKey);
    }
    setSelection(newSelection);
  };

  const renderCellContent = (column: TableColumn<T>, item: T) => {




    if (column.render) {
      const value = typeof column.accessor === 'function' 
        ? column.accessor(item)
        : item[column.accessor];
      return column.render(value, item);
    }

    if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }

    const value = item[column.accessor];
    
    // Handle common data types




    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      );
    }





    if (value && typeof value === 'object' && 'toLocaleDateString' in value) {
      return (value as Date).toLocaleDateString();
    }

    if (typeof value === 'string' && value.includes('@')) {
      return <span className="text-sm text-muted-foreground">{value}</span>;
    }

    return String(value || '');
  };

  const selectedItemsData = data.filter(item => 
    selection.has(String(item[keyAccessor]))
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {title || 'Data Table'}
          </CardTitle>
          <div className="flex items-center gap-4">
            {selection.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {selection.size} selected
              </span>
            )}
            {bulkActions.length > 0 && selection.size > 0 && (
              <div className="flex gap-2">
                {bulkActions.map((action, _index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                    onClick={() => action.onClick(selectedItemsData)}
                  >
                    {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={data.length > 0 && selection.size === data.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all items"
                    />
                  </TableHead>
                )}
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`${column.width ? `w-${column.width}` : ''} ${
                      column.hideOnMobile ? 'hidden sm:table-cell' : ''
                    } ${column.className || ''}`}
                  >
                    {column.label}
                  </TableHead>
                ))}
                {actions.length > 0 && (
                  <TableHead className="w-12"></TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {emptyMessage || 'No data available'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => {
                  const itemKey = String(item[keyAccessor]);
                  return (
                    <TableRow key={itemKey} className="group">
                      {selectable && (
                        <TableCell>
                          <Checkbox
                            checked={selection.has(itemKey)}
                            onCheckedChange={(checked) => handleItemSelection(itemKey, checked as boolean)}
                            aria-label="Select item"
                          />
                        </TableCell>
                      )}
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={`${column.hideOnMobile ? 'hidden sm:table-cell' : ''} ${column.className || ''}`}
                        >
                          {renderCellContent(column, item)}
                        </TableCell>
                      ))}
                      {actions.length > 0 && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {actions.map((action, _index) => (
                                <React.Fragment key={index}>
                                  {action.separator && <DropdownMenuSeparator />}
                                  <DropdownMenuItem
                                    onClick={() => action.onClick(item)}
                                    disabled={action.disabled ? action.
   * Disable .
   * @returns false}
                                    className= result.

   * Disable .
   * @returns false}
                                    className= result.


disabled(item) : false}
                                    className={action.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
                                  >
                                    {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                                    {action.label}
                                  </DropdownMenuItem>
                                </React.Fragment>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
} */
