import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
// import { UserListComponent } from '@/components/admin/user-list';
// import { BulkActionsBar } from '@/components/admin/bulk-actions-bar';
// import { SendInvitationDialog } from '@/components/admin/send-invitation-dialog';
// import { InvitationManagement } from '@/components/admin/invitation-management';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  // const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  // Fetch users
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: true,
  });

  // Invitations temporarily disabled
  // const { data: invitations = [], isLoading: invitationsLoading, refetch: refetchInvitations } = useQuery<any[]>({
  //   queryKey: ['/api/invitations'],
  //   enabled: true,
  // });

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
        title: 'Success',
        description: 'User updated successfully',
      });
      setSelectedUsers(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (_error: Error) => {
      toast({
        title: 'Error',
        description: _error.message,
        variant: 'destructive',
      });
    },
  });

  const handleBulkAction = async (action: string, data?: Record<string, unknown>) => {
    await bulkActionMutation.mutateAsync({ action, data });
  };

  // All invitation-related handlers temporarily disabled

  // Calculate stats and pagination
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter((user: User) => user.isActive).length || 0;
  const adminUsers = users?.filter((user: User) => user.role === 'admin').length || 0;
  
  // Pagination calculations
  const totalPages = Math.ceil(totalUsers / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = users?.slice(startIndex, endIndex) || [];

  if (usersError) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header 
          title="User Management"
          subtitle="Manage All Users"
        />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">An error occurred</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header 
        title="User Management"
        subtitle="Manage All Users"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Users
              </CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUsers}</div>
              <p className="text-xs text-muted-foreground">
                Active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Admin
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminUsers}</div>
              <p className="text-xs text-muted-foreground">
                Role
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
                Users
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Invitations
              </TabsTrigger>
            </TabsList>

            <Button disabled>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User (Coming Soon)
            </Button>
          </div>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                {usersLoading ? (
                  <p>Loading users...</p>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">User List</h3>
                    <p>Found {totalUsers} users total.</p>
                    <div className="text-sm text-gray-600">
                      <p>• Active users: {activeUsers}</p>
                      <p>• Admin users: {adminUsers}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      Full user management functionality is being updated and will be available soon.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="invitations" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <p>Invitations management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Send Invitation Dialog - Temporarily disabled */}
        {/*<SendInvitationDialog
          open={invitationDialogOpen}
          onOpenChange={setInvitationDialogOpen}
          onSuccess={handleInvitationSent}
        />*/}
      </div>
    </div>
  );
}