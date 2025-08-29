import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useDeleteMutation } from '@/lib/common-hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ColumnConfig, TableAction, BulkAction } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
// import { Button } from '@/components/ui/button'; // Removed unused import
import {
  UserX,
  // UserCheck, // Removed unused import
  Edit,
  Trash2,
  Mail,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@shared/schema';
// import { DataTable, type TableColumn, type TableAction, type BulkAction } from '@/components/ui/data-table';
import { BaseDialog } from '@/components/ui/base-dialog';
import { StandardForm, type FormFieldConfig } from '@/components/ui/standard-form';
// import { useApiMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/use-api-handler';
import { z } from 'zod';

/**
 * Props for the UserListComponent.
 * Manages user display, selection, and bulk actions.
 */
interface UserListComponentProps {
  users: User[];
  selectedUsers: Set<string>;
  onSelectionChange: (_selection: Set<string>) => void;
  onBulkAction: (_action: string, _data?: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}

// Validation schema for user editing
const editUserSchema = z.object({
  role: z.enum(['admin', 'manager', 'tenant']),
  isActive: z.boolean(),
});

/**
 * Props for the EditUserDialog component.
 */
interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Edit User Dialog Component - Now using BaseDialog and StandardForm.
 * @param root0 - The component props.
 * @param root0.user - The user object to edit.
 * @param root0.open - Whether the dialog is open.
 * @param root0.onOpenChange - Callback when dialog open state changes.
 * @param root0.onSuccess - Callback when edit is successful.
 * @returns JSX element for the edit user dialog.
 */
function EditUserDialog({ user, open, onOpenChange, onSuccess }: EditUserDialogProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', `/api/users/${user?.id}`, data),
    onSuccess: () => {
      onOpenChange(false);
      onSuccess();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });

  const formFields: FormFieldConfig[] = [
    {
      name: 'role',
      label: t('role'),
      type: 'select',
      options: [
        { _value: 'admin', label: t('admin') },
        { _value: 'manager', label: t('manager') },
        { _value: 'tenant', label: t('tenant') },
      ],
    },
    {
      name: 'isActive',
      label: t('status'),
      type: 'checkbox',
      placeholder: t('activeUser'),
    },
  ];

  if (!user) {
    return null;
  }

  return (
    <BaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('editUser')}
      description={`Edit user: ${user.firstName} ${user.lastName}`}
      maxWidth='md'
    >
      <StandardForm
        schema={editUserSchema}
        fields={formFields}
        defaultValues={{
          role: user.role,
          isActive: user.isActive,
        }}
        onSubmit={(_data) =>
          updateUserMutation.mutate(_data as { role: string; isActive: boolean })
        }
        isLoading={updateUserMutation.isPending}
        submitText={t('updateUser')}
        showCancel
        onCancel={() => onOpenChange(false)}
      />
    </BaseDialog>
  );
}

/**
 * User List Component - Now using reusable DataTable.
 * @param root0 - The component props.
 * @param root0.users - Array of users to display.
 * @param root0.selectedUsers - Array of currently selected users.
 * @param root0.onSelectionChange - Callback when user selection changes.
 * @param root0.onBulkAction - Callback for bulk actions on selected users.
 * @param root0.isLoading - Whether the component is in loading state.
 * @returns JSX element for the user list component.
 */
export function UserListComponent({
  users,
  selectedUsers,
  onSelectionChange,
  onBulkAction,
  isLoading = false,
}: UserListComponentProps) {
  const { t } = useLanguage();
  const { user: currentUser, hasRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // API mutations using our reusable hooks
  const deleteUserMutation = useDeleteMutation({
    deleteFn: (id: string) => apiRequest('DELETE', `/api/users/${id}`),
    successMessage: 'User deleted successfully',
    queryKeysToInvalidate: ['/api/users'],
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/users/reset-password', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });

  const canEditUser = hasRole(['admin']);
  const canDeleteUser = hasRole(['admin']);

  const formatDate = (date: Date | string | null) => {
    if (!date) {
      return 'Never';
    }
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'tenant':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-800 hover:bg-green-200'
      : 'bg-red-100 text-red-800 hover:bg-red-200';
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast({
        title: 'Error',
        description: 'Cannot delete your own account',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.firstName} ${user.lastName}?`
    );

    if (confirmed) {
      deleteUserMutation.mutate(user.id);
    }
  };

  // Table column configuration
  const columns: ColumnConfig<User>[] = [
    {
      _key: 'avatar',
      label: '',
      accessor: (user) => (
        <Avatar className='h-8 w-8'>
          <AvatarImage src={user.profileImage || ''} />
          <AvatarFallback className='text-xs'>
            {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
          </AvatarFallback>
        </Avatar>
      ),
      width: '12',
    },
    {
      _key: 'user',
      label: t('user'),
      accessor: (user) => (
        <div>
          <div className='font-medium'>{`${user.firstName} ${user.lastName}`}</div>
          <div className='text-sm text-muted-foreground'>{user.email}</div>
        </div>
      ),
    },
    {
      _key: 'role',
      label: t('role'),
      accessor: 'role',
      hideOnMobile: true,
      render: (role) => (
        <Badge variant='secondary' className={getRoleBadgeColor(role as string)}>
          {role as string}
        </Badge>
      ),
    },
    {
      _key: 'status',
      label: t('status'),
      accessor: 'isActive',
      hideOnMobile: true,
      render: (isActive) => (
        <Badge variant='secondary' className={getStatusBadgeColor(isActive as boolean)}>
          {(isActive as boolean) ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      _key: 'lastLogin',
      label: t('lastLogin'),
      accessor: (user) => formatDate(user.lastLoginAt),
      hideOnMobile: true,
      className: 'text-sm text-muted-foreground',
    },
    {
      _key: 'joinedDate',
      label: t('joinedDate'),
      accessor: (user) => formatDate(user.createdAt),
      hideOnMobile: true,
      className: 'text-sm text-muted-foreground',
    },
  ];

  // Table actions configuration
  const actions: TableAction<User>[] = [
    ...(canEditUser
      ? [
          {
            label: 'Edit User',
            icon: Edit,
            onClick: handleEditUser,
          },
        ]
      : []),
    {
      label: 'Reset Password',
      icon: Mail,
      onClick: (user: User) => resetPasswordMutation.mutate(user.id),
    },
    ...(canEditUser
      ? [
          {
            label: 'Toggle Status',
            icon: UserX,
            onClick: (user: User) => onBulkAction('toggle_status', { userIds: [user.id] }),
          },
        ]
      : []),
    ...(canDeleteUser
      ? [
          {
            label: 'Delete User',
            icon: Trash2,
            onClick: handleDeleteUser,
            disabled: (user: User) => user.id === currentUser?.id,
            variant: 'destructive' as const,
            separator: true,
          },
        ]
      : []),
  ];

  // Bulk actions configuration
  const bulkActions: BulkAction<User>[] = [
    ...(canEditUser
      ? [
          {
            label: 'Activate Selected',
            onClick: (users: User[]) =>
              onBulkAction('bulk_activate', { userIds: users.map((u) => u.id) }),
          },
          {
            label: 'Deactivate Selected',
            onClick: (users: User[]) =>
              onBulkAction('bulk_deactivate', { userIds: users.map((u) => u.id) }),
          },
        ]
      : []),
    ...(canDeleteUser
      ? [
          {
            label: 'Delete Selected',
            variant: 'destructive' as const,
            onClick: (users: User[]) => {
              const userIds = users.filter((u) => u.id !== currentUser?.id).map((u) => u.id);
              if (userIds.length > 0) {
                const confirmed = window.confirm(`Delete ${userIds.length} selected users?`);
                if (confirmed) {
                  onBulkAction('bulk_delete', { userIds });
                }
              }
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        data={users}
        columns={columns}
        actions={actions}
        bulkActions={bulkActions}
        keyAccessor='id'
        title={t('usersList')}
        selectable
        isLoading={isLoading}
        emptyMessage={t('noUsersFound')}
        selectedItems={selectedUsers}
        onSelectionChange={onSelectionChange}
      />

      <EditUserDialog
        user={editingUser}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/users'] });
          setEditingUser(null);
        }}
      />
    </>
  );
}
