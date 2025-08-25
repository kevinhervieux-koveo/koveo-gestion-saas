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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  Trash2, 
  Mail,
  Download
} from 'lucide-react';

/**
 * Props for the BulkActionsBar component.
 */
interface BulkActionsBarProps {
  selectedCount: number;
  onBulkAction: (_action: string, _data?: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Available bulk action types for user management.
 */
type BulkActionType = 
  | 'activate'
  | 'deactivate'
  | 'change_role'
  | 'send_password_reset'
  | 'delete'
  | 'export'
  | 'send_welcome_email';

/**
 * Configuration for a bulk action button and its behavior.
 */
interface BulkAction {
  type: BulkActionType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  requiresConfirmation?: boolean;
  requiresData?: boolean;
}

/**
 * Bulk Actions Bar Component.
 * 
 * Provides bulk operations for selected users with confirmation dialogs
 * and appropriate permissions checking.
 * @param props - Component props.
 * @param props.selectedCount - Number of selected items.
 * @param props.onBulkAction - Callback for bulk actions.
 * @param props.isLoading - Loading state indicator.
 * @returns JSX element for the bulk actions bar.
 */
export function BulkActionsBar({ 
  selectedCount, 
  onBulkAction, 
  isLoading = false 
}: BulkActionsBarProps) {
  const { t } = useLanguage();
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [roleForBulkChange, setRoleForBulkChange] = useState<string>('');
  const [confirmationDialog, setConfirmationDialog] = useState<{
    open: boolean;
    action: BulkActionType | null;
    title: string;
    description: string;
  }>({
    open: false,
    action: null,
    title: '',
    description: ''
  });

  const bulkActions: BulkAction[] = [
    {
      type: 'activate',
      label: t('activateUsers'),
      description: t('activateSelectedUsers'),
      icon: UserCheck,
      requiresConfirmation: true
    },
    {
      type: 'deactivate',
      label: t('deactivateUsers'),
      description: t('deactivateSelectedUsers'),
      icon: UserX,
      requiresConfirmation: true
    },
    {
      type: 'change_role',
      label: t('changeRole'),
      description: t('changeRoleSelectedUsers'),
      icon: Shield,
      requiresConfirmation: true,
      requiresData: true
    },
    {
      type: 'send_password_reset',
      label: t('sendPasswordReset'),
      description: t('sendPasswordResetSelectedUsers'),
      icon: Mail,
      requiresConfirmation: true
    },
    {
      type: 'send_welcome_email',
      label: t('sendWelcomeEmail'),
      description: t('sendWelcomeEmailSelectedUsers'),
      icon: Mail
    },
    {
      type: 'export',
      label: t('exportUsers'),
      description: t('exportSelectedUsersData'),
      icon: Download
    },
    {
      type: 'delete',
      label: t('deleteUsers'),
      description: t('deleteSelectedUsers'),
      icon: Trash2,
      variant: 'destructive',
      requiresConfirmation: true
    }
  ];

  const handleActionSelect = (actionType: string) => {
    setSelectedAction(actionType);
    const action = bulkActions.find(a => a.type === actionType);
    
    if (!action) {return;}

    if (action.requiresConfirmation) {
      setConfirmationDialog({
        open: true,
        action: action.type,
        title: action.label,
        description: `${action.description} (${selectedCount} ${t('users').toLowerCase()})`
      });
    } else {
      executeBulkAction(action.type);
    }
  };

  const executeBulkAction = async (actionType: BulkActionType) => {
    let actionData: Record<string, unknown> = {};

    switch (actionType) {
      case 'activate':
        actionData = { status: true };
        await onBulkAction('toggle_status', actionData);
        break;
      
      case 'deactivate':
        actionData = { status: false };
        await onBulkAction('toggle_status', actionData);
        break;
      
      case 'change_role':
        if (!roleForBulkChange) {return;}
        actionData = { role: roleForBulkChange };
        await onBulkAction('change_role', actionData);
        break;
      
      case 'send_password_reset':
        await onBulkAction('send_password_reset');
        break;
      
      case 'send_welcome_email':
        await onBulkAction('send_welcome_email');
        break;
      
      case 'export':
        await onBulkAction('export_users');
        break;
      
      case 'delete':
        await onBulkAction('delete_users');
        break;
      
      default:
        break;
    }

    // Reset selections
    setSelectedAction('');
    setRoleForBulkChange('');
    setConfirmationDialog({
      open: false,
      action: null,
      title: '',
      description: ''
    });
  };

  const handleConfirmAction = () => {
    if (confirmationDialog.action) {
      executeBulkAction(confirmationDialog.action);
    }
  };

  const getBulkActionButton = (action: BulkAction) => {
    const Icon = action.icon;
    return (
      <Button
        key={action.type}
        variant={action.variant || 'outline'}
        size="sm"
        onClick={() => handleActionSelect(action.type)}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        <Icon className="h-4 w-4" />
        {action.label}
      </Button>
    );
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Selected count and info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <Badge variant="secondary" className="bg-primary text-primary-foreground">
                  {selectedCount}
                </Badge>
                <span className="text-sm font-medium">
                  {t('usersSelected')}
                </span>
              </div>
            </div>

            {/* Bulk actions */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm font-medium">{t('bulkActions')}:</span>
              </div>

              {/* Quick actions */}
              <div className="hidden lg:flex gap-2">
                {bulkActions.slice(0, 4).map(getBulkActionButton)}
              </div>

              {/* More actions dropdown */}
              <Select value={selectedAction} onValueChange={handleActionSelect}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('moreActions')} />
                </SelectTrigger>
                <SelectContent>
                  {bulkActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <SelectItem key={action.type} value={action.type}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {action.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Mobile quick actions */}
              <div className="flex lg:hidden gap-2">
                {getBulkActionButton(bulkActions[0])} {/* Activate */}
                {getBulkActionButton(bulkActions[1])} {/* Deactivate */}
              </div>
            </div>
          </div>

          {/* Role selection for bulk role change */}
          {selectedAction === 'change_role' && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">{t('newRole')}:</span>
                <Select value={roleForBulkChange} onValueChange={setRoleForBulkChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t('selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t('admin')}</SelectItem>
                    <SelectItem value="manager">{t('manager')}</SelectItem>
                    <SelectItem value="tenant">{t('tenant')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => handleActionSelect('change_role')}
                  disabled={!roleForBulkChange || isLoading}
                >
                  {t('applyRoleChange')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={confirmationDialog.open} 
        onOpenChange={(open) => setConfirmationDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDialog.description}
              <br />
              <strong>{t('thisActionCannotBeUndone')}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={isLoading}
              className={confirmationDialog.action === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isLoading ? t('processing') : t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}