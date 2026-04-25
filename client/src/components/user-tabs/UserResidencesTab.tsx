import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { UserWithAssignments, Residence, Building, Organization, User } from '@shared/schema';
import { useLanguage } from '@/hooks/use-language';

interface UserResidencesTabProps {
  user: UserWithAssignments | null;
  residences: Residence[];
  buildings: Building[];
  organizations: Organization[];
  currentUser: User | null;
  currentUserResidenceIds: string[];
  currentUserOrganizationIds: string[];
  selectedBuildingIds: string[];
  selectedResidenceAssignments: any[]; // Pass selected assignments directly from parent
  onSave: (residenceAssignments: any[]) => void;
  onSelectionChange?: (residenceAssignments: any[]) => void;
  isLoading?: boolean;
}

export function UserResidencesTab({ 
  user, 
  residences, 
  buildings,
  organizations,
  currentUser,
  currentUserResidenceIds,
  currentUserOrganizationIds,
  selectedBuildingIds,
  selectedResidenceAssignments, // Accept selected assignments from parent
  onSave, 
  onSelectionChange,
  isLoading = false 
}: UserResidencesTabProps) {
  const { t } = useLanguage();
  // Remove internal state - component is now fully controlled by parent
  // const [selectedResidences, setSelectedResidences] = useState<{ 
  //   residenceId: string; 
  //   relationshipType: string; 
  // }[]>([]);
  // const initializedRef = useRef<string | null>(null);

  // Helper to extract simple residence assignments from parent's formatted assignments
  const selectedResidences = useMemo(() => {
    return selectedResidenceAssignments.map(assignment => ({
      residenceId: assignment.residenceId,
      relationshipType: assignment.relationshipType || 'tenant'
    }));
  }, [selectedResidenceAssignments]);

  // Create lookup maps for performance (O(1) lookups)
  const residenceLookup = useMemo(() => {
    if (!residences) return new Map();
    return new Map(residences.map(residence => [residence.id, residence]));
  }, [residences]);

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

  const handleResidenceToggle = (residenceId: string) => {
    // Gate interactions until data is loaded
    if (!residences || !buildings || !organizations || isLoading) return;
    
    // Fully controlled - work with parent's selection state
    const exists = selectedResidences.find(r => r.residenceId === residenceId);
    let newSelection;
    if (exists) {
      newSelection = selectedResidences.filter(r => r.residenceId !== residenceId);
    } else {
      newSelection = [...selectedResidences, { residenceId, relationshipType: 'tenant' }];
    }
    
    // Notify parent component of the selection change
    if (onSelectionChange) {
      onSelectionChange(newSelection.map(assignment => ({
        ...assignment,
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
        isActive: true
      })));
    }
  };

  const handleRelationshipTypeChange = (residenceId: string, relationshipType: string) => {
    // Gate interactions until data is loaded
    if (!residences || !buildings || !organizations || isLoading) return;
    
    // Fully controlled - work with parent's selection state
    const newSelection = selectedResidences.map(r => 
      r.residenceId === residenceId 
        ? { ...r, relationshipType }
        : r
    );
    
    // Notify parent component of the selection change
    if (onSelectionChange) {
      onSelectionChange(newSelection.map(assignment => ({
        ...assignment,
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
        isActive: true
      })));
    }
  };

  const handleSave = () => {
    onSave(selectedResidenceAssignments);
  };

  // Group residences by building and organization with filters
  const residencesByBuildingAndOrg = useMemo(() => {
    // Only show residences from selected buildings (strict cascading)
    if (selectedBuildingIds.length === 0) {
      return []; // No buildings selected, no residences to show
    }

    // The backend /api/residences endpoint already enforces RBAC and only
    // returns residences the current user is permitted to see. Here we
    // only apply the cascading filter against the user's selected buildings.
    const availableResidences = residences.filter(residence =>
      selectedBuildingIds.includes(residence.buildingId)
    );

    // Group by organization and building
    const grouped = availableResidences.reduce((acc, residence) => {
      const building = buildings.find(b => b.id === residence.buildingId);
      if (!building) return acc;
      
      const orgId = building.organizationId;
      const buildingId = building.id;
      
      if (!acc[orgId]) {
        // Use organizationName from building object (included in API response)
        acc[orgId] = {
          organizationId: orgId,
          organizationName: (building as any).organizationName || 'Unknown Organization',
          buildings: {}
        };
      }
      
      if (!acc[orgId].buildings[buildingId]) {
        acc[orgId].buildings[buildingId] = {
          building,
          residences: []
        };
      }
      
      acc[orgId].buildings[buildingId].residences.push(residence);
      return acc;
    }, {} as Record<string, { 
      organizationId: string;
      organizationName: string;
      buildings: Record<string, { building: Building; residences: Residence[] }> 
    }>);

    // Sort organizations, buildings, and residences alphabetically
    return Object.values(grouped)
      .sort((a, b) => a.organizationName.localeCompare(b.organizationName))
      .map(orgGroup => ({
        ...orgGroup,
        buildings: Object.values(orgGroup.buildings)
          .sort((a, b) => a.building.name.localeCompare(b.building.name))
          .map(buildingGroup => ({
            ...buildingGroup,
            residences: buildingGroup.residences.sort((a, b) => 
              a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })
            )
          }))
      }));
  }, [residences, buildings, organizations, selectedBuildingIds, currentUser, currentUserResidenceIds, buildingLookup, organizationLookup]);

  // Gate rendering until data is loaded to prevent undefined errors
  if (!user) return null;
  if (!residences || !buildings || !organizations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Residence Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading residences...</p>
        </CardContent>
      </Card>
    );
  }

  const isResidenceSelected = (residenceId: string) => 
    selectedResidences.some(r => r.residenceId === residenceId);

  const getResidenceRelationshipType = (residenceId: string) => 
    selectedResidences.find(r => r.residenceId === residenceId)?.relationshipType || 'tenant';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Residence Assignments</CardTitle>
        <p className="text-sm text-muted-foreground">
          {selectedBuildingIds.length === 0 
            ? "Select buildings first to see available residences." 
            : "Select residences to grant access to. You can only assign residences you have access to."
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 max-h-60 overflow-y-auto">
          {selectedBuildingIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noBuildingsSelectedPleaseSelectBuildings')}</p>
          ) : residencesByBuildingAndOrg.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noResidencesAvailableForTheSelected')}</p>
          ) : (
            residencesByBuildingAndOrg.map((orgGroup, orgIndex) => (
              <Collapsible key={orgGroup.organizationId || orgIndex} defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left hover:bg-muted rounded">
                  <h3 className="text-sm font-semibold">
                    {orgGroup.organizationName}
                  </h3>
                  <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:rotate-[-90deg]" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 ml-2 mt-2">
                  {orgGroup.buildings.map((buildingGroup, buildingIndex) => (
                    <Collapsible key={`residences-tab-${buildingGroup.building.id || buildingIndex}`} defaultOpen>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left hover:bg-muted rounded">
                        <h4 className="text-sm font-medium">
                          {buildingGroup.building.name}
                        </h4>
                        <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:rotate-[-90deg]" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 ml-4 mt-2">
                        {buildingGroup.residences.map((residence) => (
                          <div key={residence.id} className="flex items-center space-x-2 p-2 border rounded">
                            <Checkbox
                              id={`residence-${residence.id}`}
                              checked={isResidenceSelected(residence.id)}
                              onCheckedChange={() => handleResidenceToggle(residence.id)}
                              disabled={isLoading || !residences || !buildings || !organizations}
                              data-testid={`checkbox-residence-${residence.id}`}
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={`residence-${residence.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Unit {residence.unitNumber}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {residence.bedrooms} bed, {residence.bathrooms} bath
                              </p>
                              {residence.squareFootage && (
                                <p className="text-xs text-muted-foreground">{residence.squareFootage} sq ft</p>
                              )}
                            </div>
                            {isResidenceSelected(residence.id) && (
                              <Select
                                value={getResidenceRelationshipType(residence.id)}
                                onValueChange={(value) => handleRelationshipTypeChange(residence.id, value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tenant">Tenant</SelectItem>
                                  <SelectItem value="resident">Resident</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
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
