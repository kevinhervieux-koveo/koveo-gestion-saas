import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { UserListComponent } from '@/components/admin/user-list';
import { BulkActionsBar } from '@/components/admin/bulk-actions-bar';
import { SendInvitationDialog } from '@/components/admin/send-invitation-dialog';
import { InvitationManagement } from '@/components/admin/invitation-management';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, Shield, Mail } from 'lucide-react';
import type { User } from '@shared/schema';

/**
 * User Management Page for Management Menu
 * Consolidates user management functionalities for managers and admins.
 * Provides comprehensive user administration with role-based access controls.
 */
export default function UserManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);

  // Fetch users
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: true,
  });

  // Fetch invitations
  const { data: invitations = [], isLoading: invitationsLoading, refetch: refetchInvitations } = useQuery<any[]>({
    queryKey: ['/api/invitations'],
    enabled: true,
  });

  // Bulk action handler
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, data }: { action: string; data?: Record<string, unknown> }) => {
      const selectedUserIds = Array.from(selectedUsers);
      const response = await apiRequest('POST', '/api/users/bulk-action', {
        action,
        userIds: selectedUserIds,
        data,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('userUpdatedSuccessfully'),
      });
      setSelectedUsers(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleBulkAction = async (action: string, data?: Record<string, unknown>) => {
    await bulkActionMutation.mutateAsync({ action, data });
  };

  const handleSendReminder = async (invitationId: string) => {
    try {
      await apiRequest('POST', `/api/invitations/${invitationId}/resend`);
      toast({
        title: t('success'),
        description: t('invitationSent'),
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('errorOccurred'),
        variant: 'destructive',
      });
    }
  };

  const handleInvitationSent = () => {
    refetchInvitations();
    setInvitationDialogOpen(false);
  };

  // Calculate stats
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter((user: User) => user.isActive).length || 0;
  const adminUsers = users?.filter((user: User) => user.role === 'admin').length || 0;

  if (usersError) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header 
          title={t('userManagement')}
          subtitle={t('manageAllUsers')}
        />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">{t('errorOccurred')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header 
        title={t('userManagement')}
        subtitle={t('manageAllUsers')}
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('totalUsers')}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                {t('total')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('activeUsers')}
              </CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUsers}</div>
              <p className="text-xs text-muted-foreground">
                {t('active')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('admin')}
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminUsers}</div>
              <p className="text-xs text-muted-foreground">
                {t('role')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main User Management Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('users')}
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t('invitations')}
              </TabsTrigger>
            </TabsList>

            <Button onClick={() => setInvitationDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('inviteUser')}
            </Button>
          </div>

          <TabsContent value="users" className="space-y-6">
            {selectedUsers.size > 0 && (
              <BulkActionsBar
                selectedCount={selectedUsers.size}
                onBulkAction={handleBulkAction}
                isLoading={bulkActionMutation.isPending}
              />
            )}

            <Card>
              <CardContent className="p-0">
                <UserListComponent
                  users={users || []}
                  selectedUsers={selectedUsers}
                  onSelectionChange={setSelectedUsers}
                  onBulkAction={handleBulkAction}
                  isLoading={usersLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <InvitationManagement
                  invitations={invitations || []}
                  onSendReminder={handleSendReminder}
                  onRefresh={refetchInvitations}
                  isLoading={invitationsLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Send Invitation Dialog */}
        <SendInvitationDialog
          open={invitationDialogOpen}
          onOpenChange={setInvitationDialogOpen}
          onSuccess={handleInvitationSent}
        />
      </div>
    </div>
  );
}