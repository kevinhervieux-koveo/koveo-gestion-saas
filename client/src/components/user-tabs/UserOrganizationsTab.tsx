import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { UserWithAssignments, Organization, User } from '@shared/schema';

interface UserOrganizationsTabProps {
  user: UserWithAssignments | null;
  organizations: Organization[];
  currentUser: User | null;
  currentUserOrganizations: string[];
  onSave: (organizationIds: string[]) => void;
  onSelectionChange?: (organizationIds: string[]) => void;
  isLoading?: boolean;
}

export function UserOrganizationsTab({ 
  user, 
  organizations, 
  currentUser, 
  currentUserOrganizations,
  onSave, 
  onSelectionChange,
  isLoading = false 
}: UserOrganizationsTabProps) {
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);

  useEffect(() => {
    // Don't pre-check anything - start with empty selection
    setSelectedOrganizations([]);
    // Notify parent of initial empty selection for cascading filters
    onSelectionChange?.([]);
  }, [user, onSelectionChange]);

  const handleOrganizationToggle = (organizationId: string) => {
    setSelectedOrganizations(prev => {
      const newSelection = prev.includes(organizationId)
        ? prev.filter(id => id !== organizationId)
        : [...prev, organizationId];
      
      // Notify parent of selection change for cascading filters
      onSelectionChange?.(newSelection);
      return newSelection;
    });
  };

  const handleSave = () => {
    onSave(selectedOrganizations);
  };

  if (!user) return null;

  // Filter organizations based on current user's access
  // Users can only assign organizations they have access to
  const availableOrganizations = organizations.filter(org => {
    // Admin can assign any organization
    if (currentUser?.role === 'admin') return true;
    
    // Other users can only assign organizations they have access to
    return currentUserOrganizations.includes(org.id);
  }).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Assignments</CardTitle>
        <p className="text-sm text-muted-foreground">
          Select organizations to grant access to. You can only assign organizations you have access to.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 max-h-60 overflow-y-auto">
          {availableOrganizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations available to assign.</p>
          ) : (
            availableOrganizations.map((org) => (
              <div key={org.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`org-${org.id}`}
                  checked={selectedOrganizations.includes(org.id)}
                  onCheckedChange={() => handleOrganizationToggle(org.id)}
                  data-testid={`checkbox-org-${org.id}`}
                />
                <div className="flex-1">
                  <label
                    htmlFor={`org-${org.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {org.name}
                  </label>
                  <p className="text-xs text-muted-foreground capitalize">{org.type} organization</p>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isLoading} data-testid="save-organizations">
            {isLoading ? 'Saving...' : 'Save Organization Assignments'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}