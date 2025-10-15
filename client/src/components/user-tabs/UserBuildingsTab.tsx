import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { UserWithAssignments, Building, Organization, User } from '@shared/schema';

interface UserBuildingsTabProps {
  user: UserWithAssignments | null;
  buildings: Building[];
  organizations: Organization[];
  currentUser: User | null;
  currentUserBuildingIds: string[];
  currentUserOrganizationIds: string[];
  selectedOrganizationIds: string[];
  selectedBuildingIds: string[]; // Pass selected IDs directly from parent
  onSave: (buildingIds: string[]) => void;
  onSelectionChange?: (buildingIds: string[]) => void;
  isLoading?: boolean;
}

export function UserBuildingsTab({ 
  user, 
  buildings, 
  organizations,
  currentUser,
  currentUserBuildingIds,
  currentUserOrganizationIds,
  selectedOrganizationIds,
  selectedBuildingIds, // Accept selected IDs from parent
  onSave, 
  onSelectionChange,
  isLoading = false 
}: UserBuildingsTabProps) {
  // Remove internal state - component is now fully controlled by parent
  // const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  // const initializedRef = useRef<string | null>(null);

  // Create lookup maps for performance (O(1) lookups)
  const buildingLookup = useMemo(() => {
    if (!buildings) return new Map();
    return new Map(buildings.map(building => [building.id, building]));
  }, [buildings]);

  const organizationLookup = useMemo(() => {
    if (!organizations) return new Map();
    return new Map(organizations.map(org => [org.id, org]));
  }, [organizations]);

  // REMOVED: No initialization in child components - parent is sole source of truth
  // Child components are now purely controlled - they only read from props and emit user interactions

  // REMOVED: Cascade filtering is now handled by parent component
  // Child component is fully controlled - no internal cascade logic

  const handleBuildingToggle = (buildingId: string) => {
    // Gate interactions until data is loaded
    if (!buildings || !organizations || isLoading) return;
    
    // Fully controlled - work with parent's selection state
    const newSelection = selectedBuildingIds.includes(buildingId)
      ? selectedBuildingIds.filter(id => id !== buildingId)
      : [...selectedBuildingIds, buildingId];
    
    // Notify parent of selection change
    onSelectionChange?.(newSelection);
  };

  const handleSave = () => {
    onSave(selectedBuildingIds);
  };

  // Group buildings by organization and apply filters
  const buildingsByOrganization = useMemo(() => {
    console.log('🏢 [UserBuildingsTab] Filtering buildings:', {
      selectedOrganizationIds,
      totalBuildings: buildings.length,
      currentUserRole: currentUser?.role,
      currentUserOrganizationIds,
      currentUserBuildingIds
    });

    // Only show buildings from selected organizations (strict cascading)
    if (selectedOrganizationIds.length === 0) {
      console.log('⚠️ [UserBuildingsTab] No organizations selected');
      return []; // No organizations selected, no buildings to show
    }

    // Filter buildings based on selected organizations and user access
    const availableBuildings = buildings.filter(building => {
      // Must be in a selected organization (strict cascading filter)
      if (!selectedOrganizationIds.includes(building.organizationId)) {
        console.log(`❌ [UserBuildingsTab] Building ${building.name} not in selected orgs (${building.organizationId})`);
        return false;
      }
      
      // Admin can access all buildings
      if (currentUser?.role === 'admin') return true;
      
      // Managers can assign any building from their organization(s)
      if (currentUser?.role === 'manager' || currentUser?.role === 'demo_manager') {
        const hasAccess = currentUserOrganizationIds.includes(building.organizationId);
        console.log(`${hasAccess ? '✅' : '❌'} [UserBuildingsTab] Manager access to ${building.name}: ${hasAccess}`);
        return hasAccess;
      }
      
      // Other users can only assign buildings they have access to
      return currentUserBuildingIds.includes(building.id);
    });

    console.log('✅ [UserBuildingsTab] Available buildings after filter:', availableBuildings.length);

    // Group by organization
    const grouped = availableBuildings.reduce((acc, building) => {
      const orgId = building.organizationId;
      if (!acc[orgId]) {
        const org = organizations.find(o => o.id === orgId);
        acc[orgId] = {
          organization: org,
          buildings: []
        };
      }
      acc[orgId].buildings.push(building);
      return acc;
    }, {} as Record<string, { organization?: Organization; buildings: Building[] }>);

    // Sort organizations and buildings alphabetically
    return Object.values(grouped)
      .sort((a, b) => (a.organization?.name || '').localeCompare(b.organization?.name || ''))
      .map(group => ({
        ...group,
        buildings: group.buildings.sort((a, b) => a.name.localeCompare(b.name))
      }));
  }, [buildings, organizations, selectedOrganizationIds, currentUser, currentUserBuildingIds, organizationLookup]);

  // Gate rendering until data is loaded to prevent undefined errors
  if (!user) return null;
  if (!buildings || !organizations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Building Access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading buildings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Building Access</CardTitle>
        <p className="text-sm text-muted-foreground">
          {selectedOrganizationIds.length === 0 
            ? "Select organizations first to see available buildings." 
            : "Select buildings to grant access to. You can only assign buildings you have access to."
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 max-h-60 overflow-y-auto">
          {selectedOrganizationIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations selected. Please select organizations first.</p>
          ) : buildingsByOrganization.length === 0 ? (
            <p className="text-sm text-muted-foreground">No buildings available for the selected organizations.</p>
          ) : (
            buildingsByOrganization.map((group, groupIndex) => (
              <Collapsible key={group.organization?.id || groupIndex} defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left hover:bg-muted rounded">
                  <h4 className="text-sm font-medium">
                    {group.organization?.name || 'Unknown Organization'}
                  </h4>
                  <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:rotate-[-90deg]" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 ml-4 mt-2">
                  {group.buildings.map((building) => (
                    <div key={`buildings-tab-${building.id}`} className="flex items-center space-x-2 p-2 border rounded">
                      <Checkbox
                        id={`building-${building.id}`}
                        checked={selectedBuildingIds.includes(building.id)}
                        onCheckedChange={() => handleBuildingToggle(building.id)}
                        disabled={isLoading || !buildings || !organizations}
                        data-testid={`checkbox-building-${building.id}`}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`building-${building.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {building.name}
                        </label>
                        <p className="text-xs text-muted-foreground">{building.address}, {building.city}</p>
                        <p className="text-xs text-muted-foreground">{building.totalUnits} units</p>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
        
      </CardContent>
    </Card>
  );
}