import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { UserWithAssignments, Organization } from '@shared/schema';

interface UserOrganizationsTabProps {
  user: UserWithAssignments | null;
  organizations: Organization[];
  onSave: (organizationIds: string[]) => void;
  isLoading?: boolean;
}

export function UserOrganizationsTab({ user, organizations, onSave, isLoading = false }: UserOrganizationsTabProps) {
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);

  useEffect(() => {
    if (user && user.organizations) {
      setSelectedOrganizations(user.organizations.map((org: any) => org.id));
    }
  }, [user]);

  const handleOrganizationToggle = (organizationId: string) => {
    setSelectedOrganizations(prev => 
      prev.includes(organizationId)
        ? prev.filter(id => id !== organizationId)
        : [...prev, organizationId]
    );
  };

  const handleSave = () => {
    onSave(selectedOrganizations);
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Assignments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 max-h-60 overflow-y-auto">
          {organizations.map((org) => (
            <div key={org.id} className="flex items-center space-x-2">
              <Checkbox
                id={`org-${org.id}`}
                checked={selectedOrganizations.includes(org.id)}
                onCheckedChange={() => handleOrganizationToggle(org.id)}
                data-testid={`checkbox-org-${org.id}`}
              />
              <label
                htmlFor={`org-${org.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {org.name}
              </label>
            </div>
          ))}
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