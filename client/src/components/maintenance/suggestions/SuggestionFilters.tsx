import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
  X,
  Settings,
  Save,
  Calendar as CalendarIcon,
  DollarSign,
  Star,
  RotateCcw,
  ChevronDown,
  Building,
  AlertTriangle,
  Clock,
  Bookmark,
  Plus,
} from 'lucide-react';
import { SuggestionFiltersProps, type SuggestionFilters as SuggestionFiltersType, FilterPreset } from './types';
import { useLanguage } from '@/hooks/use-language';

// Filter options configuration
const suggestionTypes = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'minor_rehab', label: 'Minor Rehab' },
  { value: 'major_rehab', label: 'Major Rehab' },
  { value: 'replacement', label: 'Replacement' },
];

const priorities = [
  { value: 'low', label: 'Low', color: 'text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
];

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'completed', label: 'Completed' },
  { value: 'dismissed', label: 'Dismissed' },
];

const urgencyLevels = [
  { value: 'low', label: 'Low', description: 'No immediate concern' },
  { value: 'medium', label: 'Medium', description: 'Should be addressed' },
  { value: 'high', label: 'High', description: 'Requires attention' },
  { value: 'critical', label: 'Critical', description: 'Urgent action needed' },
];

const seasonalFactors = [
  { value: 'optimal', label: 'Optimal', description: 'Best time for work' },
  { value: 'acceptable', label: 'Acceptable', description: 'Good conditions' },
  { value: 'difficult', label: 'Difficult', description: 'Challenging conditions' },
];

/**
 * SuggestionFilters component for advanced filtering and search
 * Provides comprehensive filtering with preset management
 */
export function SuggestionFilters({
  filters,
  onFiltersChange,
  onSavePreset,
  onLoadPreset,
  presets = [],
  buildingId,
  className,
}: SuggestionFiltersProps) {
  const { t } = useLanguage();
  const { hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Fetch building elements for element type filtering
  const {
    data: elementsResponse,
    isLoading: isLoadingElements,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'elements'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/elements`);
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const elements = elementsResponse?.elements || [];

  // Unique UNIFORMAT codes from elements
  const elementTypes = useMemo(() => {
    const codes = new Set(elements.map((el: any) => el.uniformatCode).filter(Boolean));
    return Array.from(codes).map(code => ({ value: code, label: code }));
  }, [elements]);

  // Filter update helpers
  const updateFilter = <K extends keyof SuggestionFiltersType>(
    key: K,
    value: SuggestionFiltersType[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = <T extends string>(
    key: keyof SuggestionFiltersType,
    value: T,
    currentArray: T[] = []
  ) => {
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilter(key, newArray as any);
  };

  // Reset all filters
  const resetFilters = () => {
    onFiltersChange({});
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.types?.length) count++;
    if (filters.priorities?.length) count++;
    if (filters.statuses?.length) count++;
    if (filters.elementTypes?.length) count++;
    if (filters.dateRange) count++;
    if (filters.costRange) count++;
    if (filters.urgencyLevel) count++;
    if (filters.seasonalFactor) count++;
    if (filters.buildingSection) count++;
    return count;
  }, [filters]);

  // Save preset handler
  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast({
        title: "Preset Name Required",
        description: "Please enter a name for the filter preset.",
        variant: "destructive",
      });
      return;
    }

    const preset: Omit<FilterPreset, 'id' | 'createdAt' | 'createdBy'> = {
      name: presetName,
      filters,
    };

    onSavePreset?.(presetName, filters);
    setShowPresetDialog(false);
    setPresetName('');
    
    toast({
      title: "Preset Saved",
      description: `Filter preset "${presetName}" has been saved.`,
    });
  };

  return (
    <>
      <Card className={cn("w-full", className)} data-testid="suggestion-filters">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Preset Management */}
              {presets.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid="preset-menu">
                      <Bookmark className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Saved Presets</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {presets.map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        onClick={() => onLoadPreset?.(preset)}
                        data-testid={`preset-${preset.id}`}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        {preset.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Save Current Filters */}
              {hasPermission('canEditMaintenance') && activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPresetDialog(true)}
                  data-testid="save-preset-button"
                >
                  <Save className="h-4 w-4" />
                </Button>
              )}

              {/* Reset Filters */}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  data-testid="reset-filters-button"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}

              {/* Advanced Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                data-testid="toggle-advanced-filters"
              >
                <Settings className="h-4 w-4" />
                <ChevronDown className={cn(
                  "h-4 w-4 ml-1 transition-transform",
                  showAdvanced && "rotate-180"
                )} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search suggestions..."
              value={filters.search || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
            {filters.search && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => updateFilter('search', undefined)}
                data-testid="clear-search"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Suggestion Types */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Types</Label>
              <div className="flex flex-wrap gap-1">
                {suggestionTypes.map((type) => (
                  <Badge
                    key={type.value}
                    variant={filters.types?.includes(type.value as any) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => toggleArrayFilter('types', type.value, filters.types as any)}
                    data-testid={`filter-type-${type.value}`}
                  >
                    {type.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Priorities */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Priorities</Label>
              <div className="flex flex-wrap gap-1">
                {priorities.map((priority) => (
                  <Badge
                    key={priority.value}
                    variant={filters.priorities?.includes(priority.value as any) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => toggleArrayFilter('priorities', priority.value, filters.priorities as any)}
                    data-testid={`filter-priority-${priority.value}`}
                  >
                    <span className={cn("mr-1", priority.color)}>●</span>
                    {priority.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Statuses */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Status</Label>
              <div className="flex flex-wrap gap-1">
                {statuses.map((status) => (
                  <Badge
                    key={status.value}
                    variant={filters.statuses?.includes(status.value as any) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => toggleArrayFilter('statuses', status.value, filters.statuses as any)}
                    data-testid={`filter-status-${status.value}`}
                  >
                    {status.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvanced && (
            <>
              <Separator />
              
              <div className="space-y-4">
                {/* Date Range */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Due Date Range</Label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="date-range-start"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateRange?.start ? (
                            format(filters.dateRange.start, "PPP")
                          ) : (
                            <span>Start date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="calendar-popover-content" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateRange?.start}
                          onSelect={(date) => updateFilter('dateRange', {
                            ...filters.dateRange,
                            start: date || new Date(),
                            end: filters.dateRange?.end || new Date(),
                          })}
                          showActions={true}
                          onClear={() => updateFilter('dateRange', {
                            ...filters.dateRange,
                            start: undefined,
                          })}
                          onToday={() => updateFilter('dateRange', {
                            ...filters.dateRange,
                            start: new Date(),
                          })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <span className="text-muted-foreground">to</span>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="date-range-end"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateRange?.end ? (
                            format(filters.dateRange.end, "PPP")
                          ) : (
                            <span>End date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="calendar-popover-content" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateRange?.end}
                          onSelect={(date) => updateFilter('dateRange', {
                            ...filters.dateRange,
                            start: filters.dateRange?.start || new Date(),
                            end: date || new Date(),
                          })}
                          showActions={true}
                          onClear={() => updateFilter('dateRange', {
                            ...filters.dateRange,
                            end: undefined,
                          })}
                          onToday={() => updateFilter('dateRange', {
                            ...filters.dateRange,
                            end: new Date(),
                          })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    {filters.dateRange && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateFilter('dateRange', undefined)}
                        data-testid="clear-date-range"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Cost Range */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Cost Range: ${filters.costRange?.min || 0} - ${filters.costRange?.max || 100000}
                  </Label>
                  <Slider
                    min={0}
                    max={100000}
                    step={1000}
                    value={[filters.costRange?.min || 0, filters.costRange?.max || 100000]}
                    onValueChange={([min, max]) => updateFilter('costRange', { min, max })}
                    className="w-full"
                    data-testid="cost-range-slider"
                  />
                </div>

                {/* Additional Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Urgency Level */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Urgency Level</Label>
                    <Select
                      value={filters.urgencyLevel || ''}
                      onValueChange={(value) => updateFilter('urgencyLevel', value as any)}
                    >
                      <SelectTrigger data-testid="urgency-level-select">
                        <SelectValue placeholder="Any urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any urgency</SelectItem>
                        {urgencyLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <div>
                              <div className="font-medium">{level.label}</div>
                              <div className="text-xs text-muted-foreground">{level.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seasonal Factor */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Seasonal Timing</Label>
                    <Select
                      value={filters.seasonalFactor || ''}
                      onValueChange={(value) => updateFilter('seasonalFactor', value as any)}
                    >
                      <SelectTrigger data-testid="seasonal-factor-select">
                        <SelectValue placeholder="Any timing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any timing</SelectItem>
                        {seasonalFactors.map((factor) => (
                          <SelectItem key={factor.value} value={factor.value}>
                            <div>
                              <div className="font-medium">{factor.label}</div>
                              <div className="text-xs text-muted-foreground">{factor.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Building Section */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Building Section</Label>
                    <Input
                      placeholder="e.g., North Wing, Floor 3"
                      value={filters.buildingSection || ''}
                      onChange={(e) => updateFilter('buildingSection', e.target.value)}
                      data-testid="building-section-input"
                    />
                  </div>
                </div>

                {/* Element Types */}
                {elementTypes.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Element Types (UNIFORMAT)</Label>
                    <div className="max-h-24 overflow-y-auto border rounded-md p-2">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {elementTypes.map((type) => (
                          <div key={type.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`element-type-${type.value}`}
                              checked={filters.elementTypes?.includes(type.value) || false}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  toggleArrayFilter('elementTypes', type.value, filters.elementTypes);
                                } else {
                                  updateFilter('elementTypes', 
                                    filters.elementTypes?.filter(t => t !== type.value) || []
                                  );
                                }
                              }}
                              data-testid={`element-type-${type.value}`}
                            />
                            <Label
                              htmlFor={`element-type-${type.value}`}
                              className="text-xs font-mono"
                            >
                              {type.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Preset Dialog */}
      <AlertDialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
        <AlertDialogContent data-testid="save-preset-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Save Filter Preset</AlertDialogTitle>
            <AlertDialogDescription>
              {t('giveYourFilterPresetAName')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              placeholder="e.g., Critical Overdue Items"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              data-testid="preset-name-input"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowPresetDialog(false);
                setPresetName('');
              }}
              data-testid="cancel-save-preset"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              data-testid="confirm-save-preset"
            >
              Save Preset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}