import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface BillCreateFormProps {
  onClose: () => void;
  selectedBuilding?: any;
  buildingId?: string;
  onSuccess?: () => void;
}

export function BillCreateForm({ onClose, selectedBuilding }: BillCreateFormProps) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Create New Bill</h2>
      <p className="text-gray-600 mb-4">
        Bill creation form for {selectedBuilding?.name || 'selected building'}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button>Create Bill</Button>
      </div>
    </Card>
  );
}