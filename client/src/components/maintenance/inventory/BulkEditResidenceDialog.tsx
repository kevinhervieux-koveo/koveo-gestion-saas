import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Building, Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface BulkEditResidenceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedElementIds: string[];
  buildingId: string;
  onSuccess?: () => void;
}

interface FormData {
  residenceId: string | null;
  accessType: string;
  chargeType: string;
}

export function BulkEditResidenceDialog({
  isOpen,
  onOpenChange,
  selectedElementIds,
  buildingId,
  onSuccess,
}: BulkEditResidenceDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    residenceId: null,
    accessType: '',
    chargeType: '',
  });
  const [fieldsToUpdate, setFieldsToUpdate] = useState({
    residenceId: false,
    accessType: false,
    chargeType: false,
  });

  // Reset form state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        residenceId: null,
        accessType: '',
        chargeType: '',
      });
      setFieldsToUpdate({
        residenceId: false,
        accessType: false,
        chargeType: false,
      });
    }
  }, [isOpen]);

  // Fetch residences for the building
  const { data: residences } = useQuery({
    queryKey: ['residences', buildingId],
    queryFn: async () => {
      if (!buildingId) return [];
      const response = await apiRequest('GET', `/api/buildings/${buildingId}/residences`);
      return await response.json();
    },
    enabled: !!buildingId && isOpen,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Bulk residence assignment update mutation
  const updateAssignmentMutation = useMutation({
    mutationFn: async () => {
      const updates: Partial<FormData> = {};
      
      if (fieldsToUpdate.residenceId) {
        updates.residenceId = formData.residenceId;
      }
      if (fieldsToUpdate.accessType && formData.accessType) {
        updates.accessType = formData.accessType;
      }
      if (fieldsToUpdate.chargeType && formData.chargeType) {
        updates.chargeType = formData.chargeType;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('Please select at least one field to update');
      }

      const response = await apiRequest('PATCH', '/api/maintenance/elements/bulk-assignment', {
        elementIds: selectedElementIds,
        buildingId,
        updates,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'elements'] });
      toast({
        title: 'Assignment updated',
        description: `Successfully updated assignment for ${selectedElementIds.length} element(s)`,
      });
      onSuccess?.();
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update element assignments',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setFormData({
      residenceId: null,
      accessType: '',
      chargeType: '',
    });
    setFieldsToUpdate({
      residenceId: false,
      accessType: false,
      chargeType: false,
    });
  };

  const handleSubmit = () => {
    updateAssignmentMutation.mutate();
  };

  const handleFieldToggle = (field: keyof typeof fieldsToUpdate, checked: boolean) => {
    setFieldsToUpdate(prev => ({
      ...prev,
      [field]: checked,
    }));
  };

  const handleFormChange = (field: keyof FormData, value: string | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const hasSelectedFields = Object.values(fieldsToUpdate).some(Boolean);
  const isValidForm = hasSelectedFields && (
    !fieldsToUpdate.accessType || formData.accessType !== ''
  ) && (
    !fieldsToUpdate.chargeType || formData.chargeType !== ''
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Change Assignment & Properties
          </DialogTitle>
          <DialogDescription>
            {t('updateResidenceAssignmentAccessTypeAnd')} {selectedElementIds.length} selected element(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Residence Assignment */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-residence"
                checked={fieldsToUpdate.residenceId}
                onCheckedChange={(checked) => handleFieldToggle('residenceId', !!checked)}
              />
              <Label htmlFor="update-residence" className="text-sm font-medium">
                Update Residence Assignment
              </Label>
            </div>
            
            {fieldsToUpdate.residenceId && (
              <div className="ml-6 space-y-2">
                <Select
                  value={formData.residenceId || 'building-wide'}
                  onValueChange={(value) => 
                    handleFormChange('residenceId', value === 'building-wide' ? null : value)
                  }
                >
                  <SelectTrigger data-testid="residence-select">
                    <SelectValue placeholder="Select residence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="building-wide">
                      <div className="flex flex-col">
                        <span>Building-wide</span>
                        <span className="text-xs text-muted-foreground">Common to entire building</span>
                      </div>
                    </SelectItem>
                    {residences?.map((residence: any) => (
                      <SelectItem key={residence.id} value={residence.id}>
                        <div className="flex flex-col">
                          <span>Unit {residence.unitNumber}</span>
                          <span className="text-xs text-muted-foreground">Floor {residence.floor}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Access Type */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-access"
                checked={fieldsToUpdate.accessType}
                onCheckedChange={(checked) => handleFieldToggle('accessType', !!checked)}
              />
              <Label htmlFor="update-access" className="text-sm font-medium">
                Update Access Type
              </Label>
            </div>
            
            {fieldsToUpdate.accessType && (
              <div className="ml-6 space-y-2">
                <Select
                  value={formData.accessType}
                  onValueChange={(value) => handleFormChange('accessType', value)}
                >
                  <SelectTrigger data-testid="access-type-select">
                    <SelectValue placeholder="Select access type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_restrained">
                      <div className="flex flex-col">
                        <span>Not Restrained</span>
                        <span className="text-xs text-muted-foreground">Easy access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="restrained">
                      <div className="flex flex-col">
                        <span>Restrained</span>
                        <span className="text-xs text-muted-foreground">Restricted access</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Charge Type */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-charge"
                checked={fieldsToUpdate.chargeType}
                onCheckedChange={(checked) => handleFieldToggle('chargeType', !!checked)}
              />
              <Label htmlFor="update-charge" className="text-sm font-medium">
                Update Charge Type
              </Label>
            </div>
            
            {fieldsToUpdate.chargeType && (
              <div className="ml-6 space-y-2">
                <Select
                  value={formData.chargeType}
                  onValueChange={(value) => handleFormChange('chargeType', value)}
                >
                  <SelectTrigger data-testid="charge-type-select">
                    <SelectValue placeholder="Select charge type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">
                      <div className="flex flex-col">
                        <span>Common</span>
                        <span className="text-xs text-muted-foreground">Building responsibility</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="personnal">
                      <div className="flex flex-col">
                        <span>Personal</span>
                        <span className="text-xs text-muted-foreground">Resident responsibility</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Preview */}
          {hasSelectedFields && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Changes to apply:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {fieldsToUpdate.residenceId && (
                  <li>
                    • Residence: {formData.residenceId ? 
                      `Unit ${residences?.find((r: any) => r.id === formData.residenceId)?.unitNumber || 'Unknown'}` : 
                      'Building-wide'
                    }
                  </li>
                )}
                {fieldsToUpdate.accessType && formData.accessType && (
                  <li>
                    • Access: {formData.accessType === 'not_restrained' ? 'Not Restrained' : 'Restrained'}
                  </li>
                )}
                {fieldsToUpdate.chargeType && formData.chargeType && (
                  <li>
                    • Charge: {formData.chargeType === 'common' ? 'Common' : 'Personal'}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={updateAssignmentMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidForm || updateAssignmentMutation.isPending}
            data-testid="update-assignment-button"
          >
            {updateAssignmentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Assignment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}