import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { UserWithAssignments, Building } from '@shared/schema';

interface UserBuildingsTabProps {
  user: UserWithAssignments | null;
  buildings: Building[];
  onSave: (buildingIds: string[]) => void;
  isLoading?: boolean;
}

export function UserBuildingsTab({ user, buildings, onSave, isLoading = false }: UserBuildingsTabProps) {
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);

  useEffect(() => {
    if (user && user.buildings) {
      setSelectedBuildings(user.buildings.map((building: any) => building.id));
    }
  }, [user]);

  const handleBuildingToggle = (buildingId: string) => {
    setSelectedBuildings(prev => 
      prev.includes(buildingId)
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    );
  };

  const handleSave = () => {
    onSave(selectedBuildings);
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Building Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 max-h-60 overflow-y-auto">
          {buildings.map((building) => (
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
                <p className="text-xs text-gray-500">{building.address}, {building.city}</p>
                <p className="text-xs text-gray-400">{building.totalUnits} units</p>
              </div>
            </div>
          ))}
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