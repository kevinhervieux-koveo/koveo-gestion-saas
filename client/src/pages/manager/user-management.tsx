import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Search, UserPlus } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { UserListComponent } from '@/components/admin/user-list';
import { InvitationManagement } from '@/components/admin/invitation-management';
import { SendInvitationDialog } from '@/components/admin/send-invitation-dialog';

import type { User } from '@shared/schema';

/**
 * User Management page for managers
 * Provides comprehensive user and invitation management capabilities
 * with role-based access control and Quebec-specific features.
 */
export default function UserManagement() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  // Fetch user management data
  const { data: userManagementData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/user-management'],
    enabled: !!user,
  });

  // Filter users based on search term
  const filteredUsers = (userManagementData?.users || []).filter((user: User) =>
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBulkAction = async (action: string, data?: any) => {
    try {
      // This will be handled by the UserListComponent
      await refetch();
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  const handleInvitationSuccess = () => {
    setIsInviteDialogOpen(false);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error Loading User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">Failed to load user management data. Please try again.</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Users',
      value: (userManagementData as any)?.totalUsers || 0,
      icon: Users,
      description: 'Registered users in the system',
    },
    {
      title: 'Active Users',
      value: (userManagementData as any)?.activeUsers || 0,
      icon: Users,
      description: 'Currently active users',
    },
    {
      title: 'Pending Invitations',
      value: (userManagementData as any)?.pendingInvitations || 0,
      icon: UserPlus,
      description: 'Invitations awaiting acceptance',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage users and invitations for your organization
          </p>
        </div>
        
        <SendInvitationDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          onSuccess={handleInvitationSuccess}
        />
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {selectedUsers.size > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
                {selectedUsers.size} selected
              </Badge>
            )}
          </div>

          <UserListComponent
            users={filteredUsers}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
            onBulkAction={handleBulkAction}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Pending Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InvitationManagement
            invitations={(userManagementData as any)?.invitations || []}
            onSendReminder={(invitationId) => {
              console.log('Send reminder for invitation:', invitationId);
              // TODO: Implement reminder functionality
            }}
            onRefresh={refetch}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}