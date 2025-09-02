import { useState, useEffect } from 'react';
// useMutation and useQueryClient imports removed (unused)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle, Building, Home, FileText, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

/**
 * Interface for deletion impact analysis data.
 */
interface DeletionImpact {
  organization?: { id: string; name: string };
  building?: { id: string; name: string };
  buildings?: number;
  residences: number;
  documents: number;
  potentialOrphanedUsers: number;
}

/**
 * Interface for DeleteConfirmationDialog component props.
 */
interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  entityType: 'organization' | 'building';
  entityId: string;
  entityName: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

/**
 * Delete Confirmation Dialog with Impact Analysis.
 * Shows exactly what will be deleted when cascading delete is performed.
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is open.
 * @param root0.onOpenChange - Callback when dialog open state changes.
 * @param root0.entityType - Type of entity being deleted.
 * @param root0.entityId - ID of the entity being deleted.
 * @param root0.entityName - Name of the entity being deleted.
 * @param root0.onConfirm - Callback when deletion is confirmed.
 * @param root0.isDeleting - Whether deletion is in progress.
 * @returns JSX element for the delete confirmation dialog.
 */
/**
 * DeleteConfirmationDialog function.
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.entityType
 * @param root0.entityId
 * @param root0.entityName
 * @param root0.onConfirm
 * @param root0.isDeleting
 * @returns Function result.
 */
export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  onConfirm,
  isDeleting = false,
}: DeleteConfirmationDialogProps) {
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const { toast } = useToast();

  // Fetch deletion impact when dialog opens
  useEffect(() => {
    if (open && entityId) {
      fetchDeletionImpact();
    }
  }, [open, entityId, entityType]);

  const fetchDeletionImpact = async () => {
    setLoadingImpact(true);
    try {
      const endpoint =
        entityType === 'organization'
          ? `/api/organizations/${entityId}/deletion-impact`
          : `/api/admin/buildings/${entityId}/deletion-impact`;

      const response = await apiRequest('GET', endpoint);
      const impactData = await response.json();
      setImpact(impactData);
      toast({
        title: 'Error',
        description: 'Failed to analyze deletion impact',
        variant: 'destructive',
      });
    } finally {
      setLoadingImpact(false);
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const getTotalItemsToDelete = () => {
    if (!impact) {
      return 0;
    }
    let total = 1; // The entity itself
    if (impact.buildings) {
      total += impact.buildings;
    }
    total += impact.residences;
    total += impact.documents;
    total += impact.potentialOrphanedUsers;
    return total;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-red-600 dark:text-red-400'>
            <AlertTriangle className='h-5 w-5' />
            Confirm Deletion
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please review the impact before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
            <p className='text-sm text-red-800 dark:text-red-200'>
              <strong>Warning:</strong> This action cannot be undone. Deleting this {entityType}{' '}
              will cascade and remove all related data.
            </p>
          </div>

          <div>
            <h4 className='font-medium mb-2'>
              You are about to delete:{' '}
              <span className='text-red-600 dark:text-red-400'>{entityName}</span>
            </h4>
          </div>

          {loadingImpact ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-6 w-6 animate-spin' />
              <span className='ml-2 text-sm text-gray-600 dark:text-gray-400'>
                Analyzing deletion impact...
              </span>
            </div>
          ) : impact ? (
            <div className='space-y-4'>
              <div>
                <h5 className='font-medium mb-3 text-gray-900 dark:text-gray-100'>
                  This will also delete:
                </h5>
                <div className='space-y-2'>
                  {entityType === 'organization' && impact.buildings && impact.buildings > 0 && (
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Building className='h-4 w-4 text-blue-500' />
                        <span className='text-sm'>Buildings</span>
                      </div>
                      <Badge variant='secondary'>{impact.buildings}</Badge>
                    </div>
                  )}

                  {impact.residences > 0 && (
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Home className='h-4 w-4 text-green-500' />
                        <span className='text-sm'>Residences</span>
                      </div>
                      <Badge variant='secondary'>{impact.residences}</Badge>
                    </div>
                  )}

                  {impact.documents > 0 && (
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <FileText className='h-4 w-4 text-orange-500' />
                        <span className='text-sm'>Documents</span>
                      </div>
                      <Badge variant='secondary'>{impact.documents}</Badge>
                    </div>
                  )}

                  {impact.potentialOrphanedUsers > 0 && (
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Users className='h-4 w-4 text-purple-500' />
                        <span className='text-sm'>Orphaned Users</span>
                      </div>
                      <Badge variant='secondary'>{impact.potentialOrphanedUsers}</Badge>
                    </div>
                  )}

                  {getTotalItemsToDelete() === 1 && (
                    <p className='text-sm text-gray-600 dark:text-gray-400 italic'>
                      No related entities will be affected.
                    </p>
                  )}
                </div>
              </div>

              {getTotalItemsToDelete() > 1 && (
                <div className='bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3'>
                  <p className='text-sm text-orange-800 dark:text-orange-200'>
                    <strong>Total items to delete:</strong> {getTotalItemsToDelete()}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className='text-center py-4'>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Unable to analyze deletion impact. Proceed with caution.
              </p>
            </div>
          )}

          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-3'>
            <p className='text-xs text-gray-600 dark:text-gray-400'>
              <strong>Note:</strong> Deleted items are soft-deleted and may be recoverable by system
              administrators.
            </p>
          </div>
        </div>

        <DialogFooter className='flex gap-2'>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant='destructive'
            onClick={handleConfirm}
            disabled={isDeleting || loadingImpact}
          >
            {isDeleting ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Deleting...
              </>
            ) : (
              `Delete ${entityType === 'organization' ? 'Organization' : 'Building'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
