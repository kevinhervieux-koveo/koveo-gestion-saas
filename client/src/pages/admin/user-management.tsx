import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Search, 
  Filter, 
  MoreHorizontal,
  Shield,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';
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
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { UserListComponent } from '@/components/admin/user-list';
import { InvitationManagement } from '@/components/admin/invitation-management';
import { SendInvitationDialog } from '@/components/admin/send-invitation-dialog';
import { BulkActionsBar } from '@/components/admin/bulk-actions-bar';
import type { User } from '@shared/schema';

/**
 *
 */
interface UserManagementData {
  users: User[];
  invitations: any[];
  totalUsers: number;
  activeUsers: number;
  pendingInvitations: number;
  totalInvitations: number;
}

/**
 * User Management Dashboard Component.
 * 
 * Comprehensive interface for admins/managers to manage users, invitations,
 * roles, and permissions with real-time updates and accessibility compliance.
 */
export default function UserManagement() {
  console.log('🔍 UserManagement component loading...');
  const { user: currentUser, hasRole, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  console.log('🔍 UserManagement auth state:', { currentUser, authLoading, hasRole: typeof hasRole });
  
  // State management
  const [selectedTab, setSelectedTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isInvitationDialogOpen, setIsInvitationDialogOpen] = useState(false);
  
  // Debug: Log the current state
  console.log('UserManagement render:', {
    authLoading,
    currentUser,
    userRole: currentUser?.role,
    isManager: currentUser?.role === 'manager',
    isAdmin: currentUser?.role === 'admin'
  });
  
  // Check permissions after auth is loaded - use hasRole for better reliability
  const canManageUsers = hasRole(['admin', 'manager']);
  
  console.log('Permission check:', { canManageUsers, hasRoleAdmin: hasRole('admin'), hasRoleManager: hasRole('manager') });

  // Fetch user management data
  const { 
    data: managementData, 
    isLoading, 
    error,
    refetch
  } = useQuery<UserManagementData>({
    queryKey: ['/api/user-management'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user-management');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    enabled: !!canManageUsers
  });

  // Bulk action mutations
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ userIds, action, data }: { userIds: string[], action: string, data?: any }) => {
      const response = await apiRequest('POST', '/api/users/bulk-action', {
        userIds,
        action,
        data
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-management'] });
      setSelectedUsers(new Set());
      toast({
        title: t('bulkActionSuccess'),
        description: t('bulkActionSuccessDescription'),
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

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('POST', '/api/email/send-reminder', { invitationId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('reminderSent'),
        description: t('reminderSentDescription'),
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

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  // Show loading while auth is still loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div>Loading...</div>
      </div>
    );
  }

  // Check permissions only after auth has loaded
  if (!authLoading && (!currentUser || !canManageUsers)) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('accessDenied')}
            </CardTitle>
            <CardDescription>
              {t('accessDeniedDescription')}
              {currentUser && (
                <>
                  <br /><br />
                  <small>User: {currentUser.email}, Role: {currentUser.role}</small>
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('errorLoadingData')}
            </CardTitle>
            <CardDescription>
              {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()} variant="outline">
              {t('tryAgain')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const users = (managementData as any)?.users || [];
  const invitations = (managementData as any)?.invitations || [];

  // Filter functions
  const filteredUsers = users.filter((user: any) => {
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredInvitations = invitations.filter((invitation: any) => {
    const matchesSearch = invitation.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || invitation.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || invitation.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Handle bulk actions
  const handleBulkAction = async (action: string, data?: any) => {
    const userIds = Array.from(selectedUsers);
    if (userIds.length === 0) {
      toast({
        title: t('noUsersSelected'),
        description: t('selectUsersForBulkAction'),
        variant: 'destructive',
      });
      return;
    }

    await bulkUpdateMutation.mutateAsync({ userIds, action, data });
  };

  // Stats cards data
  const stats = [
    {
      title: t('totalUsers'),
      value: (managementData as any)?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: t('activeUsers'),
      value: (managementData as any)?.activeUsers || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: t('pendingInvitations'),
      value: (managementData as any)?.pendingInvitations || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: t('totalInvitations'),
      value: (managementData as any)?.totalInvitations || 0,
      icon: Mail,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('userManagement')}</h1>
          <p className="text-muted-foreground">
            {t('manageUsersInvitationsRoles')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={() => setIsInvitationDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {t('inviteUser')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t('searchUsersInvitations')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={t('filterByRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allRoles')}</SelectItem>
                  <SelectItem value="admin">{t('admin')}</SelectItem>
                  <SelectItem value="manager">{t('manager')}</SelectItem>
                  <SelectItem value="tenant">{t('tenant')}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={t('filterByStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatuses')}</SelectItem>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="inactive">{t('inactive')}</SelectItem>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="expired">{t('expired')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedUsers.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedUsers.size}
          onBulkAction={handleBulkAction}
          isLoading={bulkUpdateMutation.isPending}
        />
      )}

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('users')} ({filteredUsers.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t('invitations')} ({filteredInvitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UserListComponent 
            users={filteredUsers}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
            onBulkAction={handleBulkAction}
            isLoading={bulkUpdateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="invitations" className="mt-6">
          <InvitationManagement 
            invitations={filteredInvitations}
            onSendReminder={(invitationId) => sendReminderMutation.mutate(invitationId)}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['/api/user-management'] })}
            isLoading={sendReminderMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Send Invitation Dialog */}
      <SendInvitationDialog 
        open={isInvitationDialogOpen}
        onOpenChange={setIsInvitationDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/user-management'] });
          toast({
            title: t('invitationSent'),
            description: t('invitationSentDescription'),
          });
        }}
      />
    </div>
  );
}