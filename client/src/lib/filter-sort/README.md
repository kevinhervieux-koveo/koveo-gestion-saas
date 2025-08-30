# FilterSort Component System

A comprehensive, reusable filter and sort component system for the Koveo Gestion application.

## Features

- **Type-safe filtering**: Supports text, number, date, select, multi-select, and boolean filters
- **Advanced operators**: Contains, equals, greater than, less than, and more
- **Flexible sorting**: Sort by any field with ascending/descending options
- **Search functionality**: Global or field-specific search
- **Presets**: Pre-configured filter combinations for common use cases
- **State persistence**: Automatically saves and restores filter state
- **Responsive design**: Works on all screen sizes
- **Accessibility**: Full keyboard navigation and screen reader support

## Quick Start

### 1. Define your configuration

```typescript
import { FilterSortConfig } from '@/lib/filter-sort';
import { AlertCircle, Clock } from 'lucide-react';

const config: FilterSortConfig = {
  filters: [
    {
      id: 'status',
      field: 'status',
      label: 'Status',
      type: 'select',
      icon: Clock,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
    {
      id: 'name',
      field: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Search by name...',
      defaultOperator: 'contains',
    },
  ],
  sortOptions: [
    { field: 'createdAt', label: 'Date Created', defaultDirection: 'desc' },
    { field: 'name', label: 'Name' },
  ],
  searchable: true,
  searchPlaceholder: 'Search...',
  persistState: true,
  storageKey: 'my-filters',
};
```

### 2. Use the hook in your component

```typescript
import { useFilterSort } from '@/lib/filter-sort';
import { FilterSort } from '@/components/filter-sort/FilterSort';

function MyComponent() {
  const { data: items = [] } = useQuery(['items']);

  const {
    filteredData,
    filters,
    sort,
    search,
    addFilter,
    removeFilter,
    clearFilters,
    toggleSort,
    setSearch,
    activeFilterCount,
    resultCount,
  } = useFilterSort({
    data: items,
    config,
  });

  return (
    <>
      <FilterSort
        config={config}
        filters={filters}
        sort={sort}
        search={search}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
        onClearFilters={clearFilters}
        onToggleSort={toggleSort}
        onSetSearch={setSearch}
        activeFilterCount={activeFilterCount}
        resultCount={resultCount}
        totalCount={items.length}
      />

      {/* Display filtered data */}
      {filteredData.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </>
  );
}
```

## Filter Types

### Text Filter

```typescript
{
  id: 'title',
  field: 'title',
  label: 'Title',
  type: 'text',
  placeholder: 'Enter title...',
  operators: ['contains', 'equals', 'starts_with', 'ends_with'],
}
```

### Number Filter

```typescript
{
  id: 'price',
  field: 'price',
  label: 'Price',
  type: 'number',
  placeholder: 'Enter price...',
  operators: ['equals', 'greater_than', 'less_than'],
}
```

### Select Filter

```typescript
{
  id: 'category',
  field: 'category',
  label: 'Category',
  type: 'select',
  options: [
    { label: 'Electronics', value: 'electronics' },
    { label: 'Clothing', value: 'clothing' },
  ],
}
```

### Date Filter

```typescript
{
  id: 'date',
  field: 'createdAt',
  label: 'Created Date',
  type: 'date',
  operators: ['equals', 'greater_than', 'less_than'],
}
```

## Presets

Presets allow you to define common filter combinations:

```typescript
presets: [
  {
    id: 'recent-active',
    name: 'Recent & Active',
    icon: Clock,
    filters: [
      { field: 'status', operator: 'equals', value: 'active' },
      { field: 'createdAt', operator: 'greater_than', value: '2024-01-01' },
    ],
    sort: { field: 'createdAt', direction: 'desc' },
  },
],
```

## Advanced Usage

### Custom Operators

Define custom operators for specific filter types:

```typescript
{
  id: 'custom',
  field: 'customField',
  label: 'Custom Field',
  type: 'text',
  operators: ['equals', 'contains', 'custom_operator'],
  defaultOperator: 'custom_operator',
}
```

### Nested Field Access

Access nested object properties using dot notation:

```typescript
{
  id: 'user_name',
  field: 'user.name',
  label: 'User Name',
  type: 'text',
}
```

### State Persistence

Enable state persistence to remember user's filter preferences:

```typescript
{
  persistState: true,
  storageKey: 'unique-filter-key', // Unique key for localStorage
}
```

## API Reference

### FilterSortConfig

| Property             | Type               | Required | Description                       |
| -------------------- | ------------------ | -------- | --------------------------------- |
| filters              | FilterConfig[]     | Yes      | Array of filter configurations    |
| sortOptions          | SortConfig[]       | Yes      | Array of sort options             |
| presets              | FilterSortPreset[] | No       | Predefined filter combinations    |
| searchable           | boolean            | No       | Enable global search              |
| searchPlaceholder    | string             | No       | Placeholder for search input      |
| searchFields         | string[]           | No       | Fields to search in               |
| allowMultipleFilters | boolean            | No       | Allow multiple filters per field  |
| persistState         | boolean            | No       | Save filter state to localStorage |
| storageKey           | string             | No       | Key for localStorage              |

### useFilterSort Hook

**Parameters:**

- `data`: Array of items to filter/sort
- `config`: FilterSortConfig object
- `initialState`: Optional initial filter state

**Returns:**

- `filteredData`: Filtered and sorted data
- `filters`: Current active filters
- `sort`: Current sort configuration
- `search`: Current search query
- `addFilter`: Function to add a filter
- `removeFilter`: Function to remove a filter
- `clearFilters`: Function to clear all filters
- `toggleSort`: Function to toggle sort direction
- `setSearch`: Function to set search query
- `hasActiveFilters`: Boolean indicating if filters are active
- `activeFilterCount`: Number of active filters
- `resultCount`: Number of filtered results

## Best Practices

1. **Use meaningful field names**: Field names should match your data structure
2. **Provide icons**: Icons help users quickly identify filter types
3. **Set default operators**: Choose the most common operator as default
4. **Use presets**: Create presets for common filter combinations
5. **Enable persistence**: Save user preferences for better UX
6. **Optimize search fields**: Specify which fields to search for better performance

## Examples

### Property Management

```typescript
const propertyFilters: FilterSortConfig = {
  filters: [
    {
      id: 'building',
      field: 'buildingId',
      label: 'Building',
      type: 'select',
      icon: Building,
      options: buildings.map((b) => ({
        label: b.name,
        value: b.id,
      })),
    },
    {
      id: 'status',
      field: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Occupied', value: 'occupied', color: 'green' },
        { label: 'Vacant', value: 'vacant', color: 'yellow' },
        { label: 'Maintenance', value: 'maintenance', color: 'red' },
      ],
    },
    {
      id: 'rent',
      field: 'monthlyRent',
      label: 'Monthly Rent',
      type: 'number',
      operators: ['greater_than', 'less_than', 'equals'],
    },
  ],
  sortOptions: [
    { field: 'unitNumber', label: 'Unit Number' },
    { field: 'monthlyRent', label: 'Rent' },
    { field: 'squareFootage', label: 'Size' },
  ],
  presets: [
    {
      id: 'vacant-units',
      name: 'Vacant Units',
      filters: [{ field: 'status', operator: 'equals', value: 'vacant' }],
    },
    {
      id: 'high-value',
      name: 'Premium Units',
      filters: [{ field: 'monthlyRent', operator: 'greater_than', value: 2000 }],
      sort: { field: 'monthlyRent', direction: 'desc' },
    },
  ],
};
```

### Task Management

```typescript
const taskFilters: FilterSortConfig = {
  filters: [
    {
      id: 'priority',
      field: 'priority',
      label: 'Priority',
      type: 'select',
      icon: AlertCircle,
      options: [
        { label: 'Critical', value: 'critical', color: 'red' },
        { label: 'High', value: 'high', color: 'orange' },
        { label: 'Medium', value: 'medium', color: 'yellow' },
        { label: 'Low', value: 'low', color: 'blue' },
      ],
    },
    {
      id: 'assignee',
      field: 'assignedTo',
      label: 'Assigned To',
      type: 'select',
      options: users.map((u) => ({
        label: u.name,
        value: u.id,
      })),
    },
    {
      id: 'dueDate',
      field: 'dueDate',
      label: 'Due Date',
      type: 'date',
      operators: ['less_than', 'equals'],
    },
  ],
  sortOptions: [
    { field: 'dueDate', label: 'Due Date' },
    { field: 'priority', label: 'Priority' },
    { field: 'createdAt', label: 'Created' },
  ],
};
```
