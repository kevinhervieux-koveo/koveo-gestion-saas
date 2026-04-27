import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { DollarSign, Loader2 } from 'lucide-react';

interface BulkEditCostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedElementIds: string[];
  buildingId: string;
  onSuccess?: () => void;
}

export function BulkEditCostDialog({
  isOpen,
  onOpenChange,
  selectedElementIds,
  buildingId,
  onSuccess,
}: BulkEditCostDialogProps) {
  const { t, tp } = useLanguage();
  const { toast } = useToast();
  const [costType, setCostType] = useState<'per-element' | 'per-unit'>('per-element');
  const [costValue, setCostValue] = useState<string>('');

  // Reset form state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setCostValue('');
      setCostType('per-element');
    }
  }, [isOpen]);

  // Bulk cost update mutation
  const updateCostMutation = useMutation({
    mutationFn: async () => {
      const cost = parseFloat(costValue);
      if (isNaN(cost) || cost <= 0) {
        throw new Error(t('bulkCostInvalidAmountError'));
      }

      const response = await apiRequest('PATCH', '/api/maintenance/elements/bulk-cost', {
        elementIds: selectedElementIds,
        buildingId,
        costType,
        costValue: cost,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'elements'] });
      toast({
        title: t('bulkCostToastUpdatedTitle'),
        description: tp('bulkCostToastUpdatedDesc', selectedElementIds.length),
      });
      onSuccess?.();
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: t('bulkCostToastFailedTitle'),
        description: error.message || t('bulkCostToastFailedDesc'),
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setCostValue('');
    setCostType('per-element');
  };

  const handleSubmit = () => {
    updateCostMutation.mutate();
  };

  const isValidCost = costValue && !isNaN(parseFloat(costValue)) && parseFloat(costValue) > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('bulkCostUpdateTitle')}
          </DialogTitle>
          <DialogDescription>
            {tp('bulkCostUpdateDesc', selectedElementIds.length)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cost Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('bulkCostAssignmentType')}</Label>
            <RadioGroup value={costType} onValueChange={(value) => setCostType(value as 'per-element' | 'per-unit')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="per-element" id="per-element" />
                <Label htmlFor="per-element" className="text-sm">
                  {t('bulkCostPerElement')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="per-unit" id="per-unit" />
                <Label htmlFor="per-unit" className="text-sm">
                  {t('bulkCostPerUnit')}
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {costType === 'per-element'
                ? t('bulkCostPerElementHint')
                : t('bulkCostPerUnitHint')
              }
            </p>
          </div>

          {/* Cost Value Input */}
          <div className="space-y-2">
            <Label htmlFor="cost-value" className="text-sm font-medium">
              {t('bulkCostAmountLabel')}
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost-value"
                type="number"
                placeholder="0.00"
                value={costValue}
                onChange={(e) => setCostValue(e.target.value)}
                className="pl-9"
                min="0"
                step="0.01"
                data-testid="cost-value-input"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {costType === 'per-element'
                ? t('bulkCostPerElementHelper')
                : t('bulkCostPerUnitHelper')}
            </p>
          </div>

          {/* Preview */}
          {isValidCost && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">{t('bulkCostPreviewLabel')}</p>
              <p className="text-sm text-muted-foreground">
                {costType === 'per-element' ? (
                  <>{t('bulkCostPreviewPerElementPrefix')}{parseFloat(costValue).toFixed(2)}{t('bulkCostPreviewPerElementSuffix')}</>
                ) : (
                  <>{t('bulkCostPreviewPerUnitPrefix')}{parseFloat(costValue).toFixed(2)}{t('bulkCostPreviewPerUnitSuffix')}</>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={updateCostMutation.isPending}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidCost || updateCostMutation.isPending}
            data-testid="update-cost-button"
          >
            {updateCostMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('updating')}
              </>
            ) : (
              t('bulkCostUpdateButton')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
