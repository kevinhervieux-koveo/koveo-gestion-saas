import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  MoreHorizontal, 
  Shield, 
  UserX, 
  UserCheck, 
  Edit, 
  Trash2,
  Mail,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@shared/schema';

/**
 *
 */
interface UserListComponentProps {
  users: User[];
  selectedUsers: Set<string>;
  onSelectionChange: (selection: Set<string>) => void;
  onBulkAction: (action: string, data?: any) => Promise<void>;
  isLoading?: boolean;
}

/**
 *
 */
interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Edit User Dialog Component
 * Allows editing user role and status.
 * @param root0
 * @param root0.user
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.onSuccess
 */
function EditUserDialog({ user, open, onOpenChange, onSuccess }: EditUserDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [role, setRole] = useState(user?.role || '');
  const [isActive, setIsActive] = useState(user?.isActive || false);

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) {return;}
      const response = await apiRequest('PUT', `/api/users/${user.id}`, {
        role,
        isActive
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('userUpdated'),
        description: t('userUpdatedSuccessfully'),
      });
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = () => {
    updateUserMutation.mutate();
  };

  if (!user) {return null;}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('editUser')}</DialogTitle>
          <DialogDescription>
            {t('editUserDescription', { name: `${user.firstName} ${user.lastName}` })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="role" className="text-right font-medium">
              {t('role')}
            </label>
            <div className="col-span-3">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('admin')}</SelectItem>
                  <SelectItem value="manager">{t('manager')}</SelectItem>
                  <SelectItem value="tenant">{t('tenant')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right font-medium">
              {t('status')}
            </label>
            <div className="col-span-3 flex items-center space-x-2">
              <Checkbox 
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked as boolean)}
                id="active-status"
              />
              <label htmlFor="active-status" className="text-sm font-medium leading-none">
                {t('activeUser')}
              </label>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateUserMutation.isPending}
          >
            {updateUserMutation.isPending ? t('updating') : t('updateUser')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * User List Component
 * Displays users in a responsive table with selection and actions.
 * @param root0
 * @param root0.users
 * @param root0.selectedUsers
 * @param root0.onSelectionChange
 * @param root0.onBulkAction
 * @param root0.isLoading
 */
export function UserListComponent({ 
  users, 
  selectedUsers, 
  onSelectionChange,
  onBulkAction,
  isLoading = false 
}: UserListComponentProps) {
  const { t } = useLanguage();
  const { user: currentUser, hasRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('DELETE', `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-management'] });
      toast({
        title: t('userDeleted'),
        description: t('userDeletedSuccessfully'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Send reset password email mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', `/api/users/${userId}/reset-password`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('passwordResetSent'),
        description: t('passwordResetEmailSent'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelection = new Set(users.map(user => user.id));
      onSelectionChange(newSelection);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    const newSelection = new Set(selectedUsers);
    if (checked) {
      newSelection.add(userId);
    } else {
      newSelection.delete(userId);
    }
    onSelectionChange(newSelection);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast({
        title: t('error'),
        description: t('cannotDeleteOwnAccount'),
        variant: 'destructive',
      });
      return;
    }

    const confirmed = window.confirm(t('confirmDeleteUser', { 
      name: `${user.firstName} ${user.lastName}` 
    }));
    
    if (confirmed) {
      await deleteUserMutation.mutateAsync(user.id);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'tenant': return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800 hover:bg-green-200'
      : 'bg-red-100 text-red-800 hover:bg-red-200';
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) {return t('never');}
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  };

  const canEditUser = hasRole(['admin']);
  const canDeleteUser = hasRole(['admin']);

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              {t('usersList')}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {selectedUsers.size > 0 && (
                <span>{t('selectedUsers', { count: selectedUsers.size })}</span>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={users.length > 0 && selectedUsers.size === users.length}
                      onCheckedChange={handleSelectAll}
                      aria-label={t('selectAllUsers')}
                    />
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>{t('user')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('role')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('status')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('lastLogin')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('joinedDate')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={(checked) => handleUserSelection(user.id, checked as boolean)}
                        aria-label={t('selectUser', { name: `${user.firstName} ${user.lastName}` })}
                      />
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImage || ''} />
                        <AvatarFallback className="text-xs">
                          {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {`${user.firstName} ${user.lastName}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge 
                        variant="secondary" 
                        className={getRoleBadgeColor(user.role)}
                      >
                        {t(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge 
                        variant="secondary"
                        className={getStatusBadgeColor(user.isActive)}
                      >
                        {user.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={t('userActions')}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          {canEditUser && (
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('editUser')}
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem 
                            onClick={() => resetPasswordMutation.mutate(user.id)}
                            disabled={resetPasswordMutation.isPending}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            {t('resetPassword')}
                          </DropdownMenuItem>
                          
                          {canEditUser && (
                            <DropdownMenuItem 
                              onClick={() => onBulkAction('toggle_status', { userIds: [user.id] })}
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  {t('deactivateUser')}
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  {t('activateUser')}
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          
                          {canDeleteUser && user.id !== currentUser?.id && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteUser(user)}
                                className="text-destructive focus:text-destructive"
                                disabled={deleteUserMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('deleteUser')}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {t('noUsersFound')}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editingUser}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/user-management'] });
          setEditingUser(null);
        }}
      />
    </>
  );
}