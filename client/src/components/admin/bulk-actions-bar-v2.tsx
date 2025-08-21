import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  Trash2, 
  Mail,
  Download
} from 'lucide-react';

import { BaseDialog } from '@/components/ui/base-dialog';
import { StandardForm, type FormFieldConfig } from '@/components/ui/standard-form';
import { z } from 'zod';

// Types
interface BulkActionsBarProps {
  selectedCount: number;
  onBulkAction: (action: string, data?: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}

type BulkActionType = 
  | 'activate'
  | 'deactivate'
  | 'change_role'
  | 'send_password_reset'
  | 'delete'
  | 'export'
  | 'send_welcome_email';

interface BulkAction {
  type: BulkActionType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  requiresConfirmation?: boolean;
  requiresData?: boolean;
  formFields?: FormFieldConfig[];
  schema?: z.ZodSchema<any>;
}

/**
 * Bulk Actions Bar Component - Refactored using reusable components
 * Reduced from 358+ lines to ~150 lines by leveraging BaseDialog and StandardForm
 */
export function BulkActionsBar({ selectedCount, onBulkAction, isLoading }: BulkActionsBarProps) {
  const { t } = useLanguage();
  const [currentAction, setCurrentAction] = useState<BulkAction | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  // Role change schema and form fields
  const roleChangeSchema = z.object({
    newRole: z.enum(['admin', 'manager', 'resident', 'tenant'], {
      required_error: 'Please select a role',
    }),
  });

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      type: 'activate',
      label: t('users.bulk.activate', 'Activate Users'),
      description: t('users.bulk.activate_desc', 'Activate selected users'),
      icon: UserCheck,
      requiresConfirmation: true,
    },
    {
      type: 'deactivate',
      label: t('users.bulk.deactivate', 'Deactivate Users'),
      description: t('users.bulk.deactivate_desc', 'Deactivate selected users'),
      icon: UserX,
      variant: 'destructive',
      requiresConfirmation: true,
    },
    {
      type: 'change_role',
      label: t('users.bulk.change_role', 'Change Role'),
      description: t('users.bulk.change_role_desc', 'Change role for selected users'),
      icon: Shield,
      requiresData: true,
      schema: roleChangeSchema,
      formFields: [
        {
          name: 'newRole',
          label: 'New Role',
          type: 'select',
          required: true,
          options: [
            { value: 'admin', label: 'Administrator' },
            { value: 'manager', label: 'Manager' },
            { value: 'resident', label: 'Resident' },
            { value: 'tenant', label: 'Tenant' },
          ],
        },
      ],
    },
    {
      type: 'send_password_reset',
      label: t('users.bulk.password_reset', 'Send Password Reset'),
      description: t('users.bulk.password_reset_desc', 'Send password reset emails'),
      icon: Mail,
      requiresConfirmation: true,
    },
    {
      type: 'send_welcome_email',
      label: t('users.bulk.welcome_email', 'Send Welcome Email'),
      description: t('users.bulk.welcome_email_desc', 'Send welcome emails to selected users'),
      icon: Mail,
      requiresConfirmation: true,
    },
    {
      type: 'export',
      label: t('users.bulk.export', 'Export Users'),
      description: t('users.bulk.export_desc', 'Export selected users data'),
      icon: Download,
    },
    {
      type: 'delete',
      label: t('users.bulk.delete', 'Delete Users'),
      description: t('users.bulk.delete_desc', 'Permanently delete selected users'),
      icon: Trash2,
      variant: 'destructive',
      requiresConfirmation: true,
    },
  ];

  // Handle action execution
  const handleAction = async (action: BulkAction, data?: Record<string, unknown>) => {
    try {
      await onBulkAction(action.type, data);
      setCurrentAction(null);
      setIsConfirmDialogOpen(false);
    } catch (error) {
      // Error handling is managed by the parent component
      console.error('Bulk action failed:', error);
    }
  };

  // Handle action click
  const handleActionClick = (action: BulkAction) => {
    setCurrentAction(action);
    
    if (action.requiresConfirmation && !action.requiresData) {
      setIsConfirmDialogOpen(true);
    } else if (action.requiresData) {
      // Open form dialog (handled by BaseDialog)
    } else {
      // Execute immediately for simple actions like export
      handleAction(action);
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">
                {selectedCount} {t('users.selected', 'user(s) selected')}
              </span>
              <Badge variant="secondary">{selectedCount}</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              {bulkActions.map((action) => (
                <Button
                  key={action.type}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={() => handleActionClick(action)}
                  disabled={isLoading}
                  className="flex items-center gap-1"
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <BaseDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        title={currentAction?.label || 'Confirm Action'}
        description={`${currentAction?.description} for ${selectedCount} selected user(s)?`}
        showFooter={true}
        footerContent={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant={currentAction?.variant || 'default'}
              onClick={() => currentAction && handleAction(currentAction)}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : t('common.confirm', 'Confirm')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {currentAction?.icon && <currentAction.icon className="h-5 w-5 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">
              This action will affect {selectedCount} selected user(s)
            </span>
          </div>
          {currentAction?.variant === 'destructive' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">
                ⚠️ This action cannot be undone. Please confirm you want to proceed.
              </p>
            </div>
          )}
        </div>
      </BaseDialog>

      {/* Form Dialog for actions requiring data */}
      {currentAction?.requiresData && currentAction.schema && currentAction.formFields && (
        <BaseDialog
          open={!!currentAction.requiresData}
          onOpenChange={(open) => !open && setCurrentAction(null)}
          title={currentAction.label}
          description={currentAction.description}
          showFooter={false}
        >
          <StandardForm
            schema={currentAction.schema}
            fields={currentAction.formFields}
            onSubmit={(data) => handleAction(currentAction, data)}
            isLoading={isLoading}
            submitText={currentAction.label}
            showCancelButton={true}
            onCancel={() => setCurrentAction(null)}
          />
        </BaseDialog>
      )}
    </>
  );
}