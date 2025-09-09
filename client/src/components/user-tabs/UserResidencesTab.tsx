import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { UserWithAssignments, Residence, Building, Organization, User } from '@shared/schema';

interface UserResidencesTabProps {
  user: UserWithAssignments | null;
  residences: Residence[];
  buildings: Building[];
  organizations: Organization[];
  currentUser: User | null;
  currentUserResidenceIds: string[];
  selectedBuildingIds: string[];
  onSave: (residenceAssignments: any[]) => void;
  isLoading?: boolean;
}

export function UserResidencesTab({ 
  user, 
  residences, 
  buildings,
  organizations,
  currentUser,
  currentUserResidenceIds,
  selectedBuildingIds,
  onSave, 
  isLoading = false 
}: UserResidencesTabProps) {
  const [selectedResidences, setSelectedResidences] = useState<{ 
    residenceId: string; 
    relationshipType: string; 
  }[]>([]);

  useEffect(() => {
    if (user && user.residences) {
      setSelectedResidences(
        user.residences.map((residence: any) => ({
          residenceId: residence.id,
          relationshipType: residence.relationshipType || 'tenant'
        }))
      );
    }
  }, [user]);

  const handleResidenceToggle = (residenceId: string) => {
    setSelectedResidences(prev => {
      const exists = prev.find(r => r.residenceId === residenceId);
      if (exists) {
        return prev.filter(r => r.residenceId !== residenceId);
      } else {
        return [...prev, { residenceId, relationshipType: 'tenant' }];
      }
    });
  };

  const handleRelationshipTypeChange = (residenceId: string, relationshipType: string) => {
    setSelectedResidences(prev =>
      prev.map(r => 
        r.residenceId === residenceId 
          ? { ...r, relationshipType }
          : r
      )
    );
  };

  const handleSave = () => {
    const assignments = selectedResidences.map(assignment => ({
      ...assignment,
      startDate: new Date().toISOString().split('T')[0],
      isActive: true
    }));
    onSave(assignments);
  };

  // Group residences by building and organization with filters
  const residencesByBuildingAndOrg = useMemo(() => {
    // Filter residences based on selected buildings and user access
    const availableResidences = residences.filter(residence => {
      // Must be in a selected building (cascading filter)
      if (selectedBuildingIds.length > 0 && !selectedBuildingIds.includes(residence.buildingId)) {
        return false;
      }
      
      // Admin can access all residences
      if (currentUser?.role === 'admin') return true;
      
      // Other users can only assign residences they have access to
      return currentUserResidenceIds.includes(residence.id);
    });

    // Group by organization and building
    const grouped = availableResidences.reduce((acc, residence) => {
      const building = buildings.find(b => b.id === residence.buildingId);
      if (!building) return acc;
      
      const orgId = building.organizationId;
      const buildingId = building.id;
      
      if (!acc[orgId]) {
        const org = organizations.find(o => o.id === orgId);
        acc[orgId] = {
          organization: org,
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
      organization?: Organization; 
      buildings: Record<string, { building: Building; residences: Residence[] }> 
    }>);

    // Sort organizations, buildings, and residences alphabetically
    return Object.values(grouped)
      .sort((a, b) => (a.organization?.name || '').localeCompare(b.organization?.name || ''))
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
  }, [residences, buildings, organizations, selectedBuildingIds, currentUser, currentUserResidenceIds]);

  if (!user) return null;

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
            <p className="text-sm text-muted-foreground">No buildings selected. Please select buildings first.</p>
          ) : residencesByBuildingAndOrg.length === 0 ? (
            <p className="text-sm text-muted-foreground">No residences available for the selected buildings.</p>
          ) : (
            residencesByBuildingAndOrg.map((orgGroup, orgIndex) => (
              <div key={orgGroup.organization?.id || orgIndex}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {orgGroup.organization?.name || 'Unknown Organization'}
                  </h3>
                  <Separator className="mt-1" />
                </div>
                <div className="space-y-4 ml-2">
                  {orgGroup.buildings.map((buildingGroup, buildingIndex) => (
                    <div key={buildingGroup.building.id || buildingIndex}>
                      <div className="mb-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          {buildingGroup.building.name}
                        </h4>
                        <Separator className="mt-1" />
                      </div>
                      <div className="space-y-2 ml-4">
                        {buildingGroup.residences.map((residence) => (
                          <div key={residence.id} className="flex items-center space-x-2 p-2 border rounded">
                            <Checkbox
                              id={`residence-${residence.id}`}
                              checked={isResidenceSelected(residence.id)}
                              onCheckedChange={() => handleResidenceToggle(residence.id)}
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isLoading} data-testid="save-residences">
            {isLoading ? 'Saving...' : 'Save Residence Assignments'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}