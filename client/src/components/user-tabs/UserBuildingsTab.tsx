import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { UserWithAssignments, Building, Organization, User } from '@shared/schema';

interface UserBuildingsTabProps {
  user: UserWithAssignments | null;
  buildings: Building[];
  organizations: Organization[];
  currentUser: User | null;
  currentUserBuildingIds: string[];
  selectedOrganizationIds: string[];
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
  selectedOrganizationIds,
  onSave, 
  onSelectionChange,
  isLoading = false 
}: UserBuildingsTabProps) {
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);

  useEffect(() => {
    if (user && user.buildings) {
      const buildingIds = user.buildings.map((building: any) => building.id);
      setSelectedBuildings(buildingIds);
      // Notify parent of initial selection for cascading filters
      onSelectionChange?.(buildingIds);
    }
  }, [user, onSelectionChange]);

  const handleBuildingToggle = (buildingId: string) => {
    setSelectedBuildings(prev => {
      const newSelection = prev.includes(buildingId)
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId];
      
      // Notify parent of selection change for cascading filters
      onSelectionChange?.(newSelection);
      return newSelection;
    });
  };

  const handleSave = () => {
    onSave(selectedBuildings);
  };

  // Group buildings by organization and apply filters
  const buildingsByOrganization = useMemo(() => {
    // Filter buildings based on selected organizations and user access
    const availableBuildings = buildings.filter(building => {
      // Must be in a selected organization (cascading filter)
      if (selectedOrganizationIds.length > 0 && !selectedOrganizationIds.includes(building.organizationId)) {
        return false;
      }
      
      // Admin can access all buildings
      if (currentUser?.role === 'admin') return true;
      
      // Other users can only assign buildings they have access to
      return currentUserBuildingIds.includes(building.id);
    });

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
  }, [buildings, organizations, selectedOrganizationIds, currentUser, currentUserBuildingIds]);

  if (!user) return null;

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
              <div key={group.organization?.id || groupIndex}>
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {group.organization?.name || 'Unknown Organization'}
                  </h4>
                  <Separator className="mt-1" />
                </div>
                <div className="space-y-2 ml-4">
                  {group.buildings.map((building) => (
                    <div key={building.id} className="flex items-center space-x-2 p-2 border rounded">
                      <Checkbox
                        id={`building-${building.id}`}
                        checked={selectedBuildings.includes(building.id)}
                        onCheckedChange={() => handleBuildingToggle(building.id)}
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
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isLoading} data-testid="save-buildings">
            {isLoading ? 'Saving...' : 'Save Building Access'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}