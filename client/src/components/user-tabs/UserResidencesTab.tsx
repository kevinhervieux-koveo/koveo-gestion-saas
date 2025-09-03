import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserWithAssignments, Residence } from '@shared/schema';

interface UserResidencesTabProps {
  user: UserWithAssignments | null;
  residences: Residence[];
  onSave: (residenceAssignments: any[]) => void;
  isLoading?: boolean;
}

export function UserResidencesTab({ user, residences, onSave, isLoading = false }: UserResidencesTabProps) {
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

  if (!user) return null;

  const isResidenceSelected = (residenceId: string) => 
    selectedResidences.some(r => r.residenceId === residenceId);

  const getResidenceRelationshipType = (residenceId: string) => 
    selectedResidences.find(r => r.residenceId === residenceId)?.relationshipType || 'tenant';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Residence Assignments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 max-h-60 overflow-y-auto">
          {residences.map((residence) => (
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
                <p className="text-xs text-gray-500">
                  {residence.bedrooms} bed, {residence.bathrooms} bath
                </p>
                {residence.squareFootage && (
                  <p className="text-xs text-gray-400">{residence.squareFootage} sq ft</p>
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
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="occupant">Occupant</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
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