"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X, Building2, CheckSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConditionBadge } from "@/components/maintenance/StatusBadges";
import { BuildingElement } from "@shared/schemas/maintenance";

export interface BuildingElementsMultiSelectProps {
  value?: string[]; // Array of selected element IDs
  onValueChange?: (value: string[]) => void;
  elements: BuildingElement[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  maxHeight?: string;
  "data-testid"?: string;
  onCreateNew?: () => void;
  createNewLabel?: string;
}

export function BuildingElementsMultiSelect({
  value = [],
  onValueChange,
  elements,
  placeholder = "Select building elements...",
  searchPlaceholder = "Search elements...",
  emptyMessage = "No elements found.",
  disabled = false,
  className,
  maxHeight = "max-h-96",
  "data-testid": testId,
  onCreateNew,
  createNewLabel = "+ Create new element",
}: BuildingElementsMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedElements = elements.filter(element => value.includes(element.id));
  
  const filteredElements = React.useMemo(() => {
    if (!searchQuery) return elements;
    
    const query = searchQuery.toLowerCase();
    return elements.filter(element => 
      element.name.toLowerCase().includes(query) ||
      element.uniformatCode.toLowerCase().includes(query) ||
      element.description?.toLowerCase().includes(query) ||
      element.currentCondition.toLowerCase().includes(query)
    );
  }, [elements, searchQuery]);

  const toggleElement = (elementId: string) => {
    if (disabled) return;
    
    const newValue = value.includes(elementId)
      ? value.filter(id => id !== elementId)
      : [...value, elementId];
    
    onValueChange?.(newValue);
  };

  const removeElement = (elementId: string) => {
    if (disabled) return;
    onValueChange?.(value.filter(id => id !== elementId));
  };

  const clearAll = () => {
    if (disabled) return;
    onValueChange?.([]);
  };

  const selectAllFiltered = () => {
    if (disabled) return;
    const filteredIds = filteredElements.map(element => element.id);
    const newValue = [...new Set([...value, ...filteredIds])];
    onValueChange?.(newValue);
  };

  const handleCreateNew = () => {
    if (disabled || !onCreateNew) return;
    setOpen(false);
    onCreateNew();
  };

  return (
    <div className="w-full space-y-2">
      {/* Selected Elements Display */}
      {selectedElements.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/20">
          {selectedElements.map((element) => (
            <Badge 
              key={element.id} 
              variant="secondary" 
              className="flex items-center gap-1 pr-1"
              data-testid={`selected-element-${element.id}`}
            >
              <span className="max-w-32 truncate" title={element.name}>
                {element.name}
              </span>
              <span className="text-xs text-muted-foreground">
                ({element.uniformatCode})
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  removeElement(element.id);
                }}
                disabled={disabled}
                className="ml-1 h-3 w-3 rounded-full flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                data-testid={`remove-element-${element.id}`}
              >
                <X className="h-2 w-2" />
              </button>
            </Badge>
          ))}
          {selectedElements.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="text-xs text-muted-foreground hover:text-destructive underline"
              data-testid="clear-all-elements"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Dropdown Trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
            disabled={disabled}
            data-testid={testId}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {selectedElements.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <span>
                  {selectedElements.length} element{selectedElements.length !== 1 ? 's' : ''} selected
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder={searchPlaceholder} 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className={maxHeight}>
              {filteredElements.length === 0 ? (
                <CommandEmpty>{emptyMessage}</CommandEmpty>
              ) : (
                <>
                  {filteredElements.length > 1 && searchQuery && (
                    <div className="px-2 py-1 border-b">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllFiltered}
                        disabled={disabled}
                        className="w-full justify-start gap-2"
                        data-testid="select-all-filtered"
                      >
                        <CheckSquare className="h-4 w-4" />
                        Select all filtered ({filteredElements.length} items)
                      </Button>
                    </div>
                  )}
                  <CommandGroup>
                {filteredElements.map((element) => {
                  const isSelected = value.includes(element.id);
                  
                  return (
                    <CommandItem
                      key={element.id}
                      value={element.id}
                      onSelect={() => toggleElement(element.id)}
                      className="flex items-center space-x-3 py-3"
                      data-testid={`element-option-${element.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleElement(element.id)}
                        className="shrink-0"
                      />
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm truncate" title={element.name}>
                            {element.name}
                          </div>
                          <ConditionBadge condition={element.currentCondition} size="sm" />
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          {element.uniformatCode}
                          {element.description && (
                            <span className="ml-2 truncate" title={element.description}>
                              • {element.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
                  </CommandGroup>
                </>
              )}

              {onCreateNew && !disabled && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value="__create_new__"
                      onSelect={handleCreateNew}
                      className="flex items-center gap-2 py-2 text-primary font-medium cursor-pointer"
                      data-testid="create-new-element"
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      {createNewLabel}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default BuildingElementsMultiSelect;
