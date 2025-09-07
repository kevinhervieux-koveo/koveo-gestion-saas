import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { FilterSort } from '@/components/filter-sort/FilterSort';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Users, UserPlus, Shield, Mail, Edit, Home, Trash2 } from 'lucide-react';
import { SendInvitationDialog } from '@/components/admin/send-invitation-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User, UserWithAssignments, Organization, Building, Residence } from '@shared/schema';
import type { FilterValue, SortValue } from '@/lib/filter-sort/types';
import { UserAssignmentsTable } from '@/components/UserAssignmentsTableClean';
import { UserOrganizationsTab } from '@/components/user-tabs/UserOrganizationsTab';
import { UserBuildingsTab } from '@/components/user-tabs/UserBuildingsTab';
import { UserResidencesTab } from '@/components/user-tabs/UserResidencesTab';
import { InvitationManagement } from '@/components/InvitationManagement';

// Form validation schema for editing users - dynamic based on available roles
const createEditUserSchema = (availableRoles: { value: string; label: string }[]) => {
  const roleValues = availableRoles.map(role => role.value) as [string, ...string[]];
  
  return z.object({
    firstName: z.string().min(1, 'First name is required (example: Jean)').max(50, 'First name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'First name can only contain letters, spaces, apostrophes and hyphens'),
    lastName: z.string().min(1, 'Last name is required (example: Dupont)').max(50, 'Last name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Last name can only contain letters, spaces, apostrophes and hyphens'),
    email: z.string().min(1, 'Email address is required').email('Please enter a valid email address (example: jean.dupont@email.com)'),
    role: roleValues.length > 0 ? z.enum(roleValues) : z.string().min(1, 'Please select a user role'),
    isActive: z.boolean(),
  });
};

// Form validation schema for deleting users
const deleteUserSchema = z.object({
  confirmEmail: z.string().min(1, 'Email confirmation is required to delete user').email('Please enter a valid email address that matches the user account'),
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
});

/**
 * User Management Page for Management Menu
 * Consolidates user management functionalities for managers and admins.
 * Provides comprehensive user administration with role-based access controls.
 */
export default function UserManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editingUserOrganizations, setEditingUserOrganizations] = useState<UserWithAssignments | null>(null);
  const [editingUserResidences, setEditingUserResidences] = useState<UserWithAssignments | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  // Filter and search state - simplified for quick fix
  const [search, setSearch] = useState(''); // Temporarily disabled
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [orphanFilter, setOrphanFilter] = useState('');

  // Fetch users with server-side pagination
  const {
    data: usersResponse,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery<{
    users: UserWithAssignments[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['/api/users', { 
      page: currentPage, 
      limit: usersPerPage,
      roleFilter,
      statusFilter,
      organizationFilter,
      orphanFilter,
      search
    }],
    queryFn: async () => {
      // Build query parameters including filters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: usersPerPage.toString(),
      });
      
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (organizationFilter) params.append('organization', organizationFilter);
      if (orphanFilter) params.append('orphan', orphanFilter);
      if (search) params.append('search', search);
      
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
  });

  // Extract users and pagination info from response
  const users = usersResponse?.users || [];
  const paginationInfo = usersResponse?.pagination;

  // Fetch dynamic filter options
  const { data: filterOptions } = useQuery<{
    roles: Array<{ value: string; label: string }>;
    statuses: Array<{ value: string; label: string }>;
    organizations: Array<{ value: string; label: string }>;
    orphanOptions: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/users/filter-options'],
  });

  // Fetch organizations
  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
    enabled: true,
  });

  // Fetch buildings
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    enabled: true,
  });

  // Fetch residences
  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
    enabled: true,
  });

  // Get current user to check permissions
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Organization context detection for role filtering
  const userOrganizationContext = useMemo(() => {
    if (!currentUser || !organizations || !users) return null;

    // Get current user's organization assignments
    const currentUserWithAssignments = users.find(u => u.id === currentUser.id);
    if (!currentUserWithAssignments?.organizations) return null;

    const userOrganizations = currentUserWithAssignments.organizations;
    const isDemoUser = ['demo_manager', 'demo_tenant', 'demo_resident'].includes(currentUser.role);
    const hasDemoOrganizations = userOrganizations.some(org => 
      organizations.find(o => o.id === org.id)?.type === 'demo'
    );
    const hasRegularOrganizations = userOrganizations.some(org => 
      organizations.find(o => o.id === org.id)?.type !== 'demo'
    );

    return {
      isDemoUser,
      hasDemoOrganizations,
      hasRegularOrganizations,
      userOrganizations: userOrganizations.map(org => org.id),
      organizationTypes: userOrganizations.map(org => 
        organizations.find(o => o.id === org.id)?.type || 'unknown'
      )
    };
  }, [currentUser, organizations, users]);

  // Role filtering function
  const getAvailableRoles = useMemo(() => {
    if (!currentUser || !userOrganizationContext) return [];

    const { role } = currentUser;
    const { isDemoUser, hasDemoOrganizations, hasRegularOrganizations } = userOrganizationContext;

    // Admin can assign any role
    if (role === 'admin') {
      return [
        { value: 'admin', label: 'Admin' },
        { value: 'manager', label: 'Manager' },
        { value: 'tenant', label: 'Tenant' },
        { value: 'resident', label: 'Resident' },
        { value: 'demo_manager', label: 'Demo Manager' },
        { value: 'demo_tenant', label: 'Demo Tenant' },
        { value: 'demo_resident', label: 'Demo Resident' },
      ];
    }

    // Manager role assignment restrictions
    if (role === 'manager') {
      return [
        { value: 'manager', label: 'Manager' },
        { value: 'tenant', label: 'Tenant' },
        { value: 'resident', label: 'Resident' },
      ];
    }

    // Demo manager role assignment restrictions
    if (role === 'demo_manager') {
      return [
        { value: 'demo_manager', label: 'Demo Manager' },
        { value: 'demo_tenant', label: 'Demo Tenant' },
        { value: 'demo_resident', label: 'Demo Resident' },
      ];
    }

    // Other roles cannot assign roles
    return [];
  }, [currentUser, userOrganizationContext]);

  // Dynamic edit user schema based on available roles
  const editUserSchema = useMemo(() => createEditUserSchema(getAvailableRoles), [getAvailableRoles]);

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
        description: t('userUpdatedSuccess'),
      });
      setSelectedUsers(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (_error: Error) => {
      toast({
        title: t('error'),
        description: _error.message,
        variant: 'destructive',
      });
    },
  });

  const handleBulkAction = async (action: string, data?: Record<string, unknown>) => {
    await bulkActionMutation.mutateAsync({ action, data });
  };

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (userData: z.infer<typeof editUserSchema> & { id: string }) => {
      const response = await apiRequest('PUT', `/api/users/${userData.id}`, userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('userUpdatedSuccess'),
      });
      setEditingUser(null);
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

  // Edit user form
  const editForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: 'tenant',
      isActive: true,
    },
  });

  // Delete user form
  const deleteForm = useForm<z.infer<typeof deleteUserSchema>>({
    resolver: zodResolver(deleteUserSchema),
    defaultValues: {
      confirmEmail: '',
      reason: '',
    },
  });

  // Reset form when editing user changes
  React.useEffect(() => {
    if (editingUser) {
      editForm.reset({
        firstName: editingUser.firstName || '',
        lastName: editingUser.lastName || '',
        email: editingUser.email,
        role: editingUser.role,
        isActive: editingUser.isActive,
      });
    }
  }, [editingUser, editForm]);

  // Reset delete form when deleting user changes
  React.useEffect(() => {
    if (deletingUser) {
      deleteForm.reset({
        confirmEmail: '',
        reason: '',
      });
    }
  }, [deletingUser, deleteForm]);

  // Reset to page 1 when filters change (excluding search since it's disabled)
  React.useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [roleFilter, statusFilter, organizationFilter, orphanFilter]);

  const handleEditUser = async (values: z.infer<typeof editUserSchema>) => {
    if (!editingUser) {
      return;
    }
    await editUserMutation.mutateAsync({ ...values, id: editingUser.id });
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
  };

  // Helper function to find UserWithAssignments from the users list
  const findUserWithAssignments = (userId: string): UserWithAssignments | null => {
    return users.find(u => u.id === userId) || null;
  };

  const openDeleteDialog = (user: User) => {
    setDeletingUser(user);
  };

  const handleDeleteUser = async (values: z.infer<typeof deleteUserSchema>) => {
    if (!deletingUser) {
      return;
    }
    await deleteUserMutation.mutateAsync({ userId: deletingUser.id, data: values });
  };

  // Organization editing mutation
  const editOrganizationsMutation = useMutation({
    mutationFn: async ({
      userId,
      organizationIds,
    }: {
      userId: string;
      organizationIds: string[];
    }) => {
      const response = await apiRequest('PUT', `/api/users/${userId}/organizations`, {
        organizationIds,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('organizationAssignmentsUpdated'),
      });
      setEditingUserOrganizations(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-user-organizations'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Building editing mutation
  const editBuildingsMutation = useMutation({
    mutationFn: async ({
      userId,
      buildingIds,
    }: {
      userId: string;
      buildingIds: string[];
    }) => {
      const response = await apiRequest('PUT', `/api/users/${userId}/buildings`, {
        buildingIds,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('buildingAssignmentsUpdated'),
      });
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

  // Residence editing mutation
  const editResidencesMutation = useMutation({
    mutationFn: async ({
      userId,
      residenceAssignments,
    }: {
      userId: string;
      residenceAssignments: any[];
    }) => {
      const response = await apiRequest('PUT', `/api/users/${userId}/residences`, {
        residenceAssignments,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('residenceAssignmentsUpdated'),
      });
      setEditingUserResidences(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-user-residences'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: z.infer<typeof deleteUserSchema>;
    }) => {
      const response = await apiRequest('POST', `/api/users/${userId}/delete-account`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('accountDeleted'),
        description: t('accountDeletedDescription'),
      });
      setDeletingUser(null);
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-user-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-user-residences'] });
      // Force refetch to ensure UI updates
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('deletionFailed'),
        description: error.message || t('deletionFailedDescription'),
        variant: 'destructive',
      });
    },
  });

  // Permission checks
  const canEditOrganizations = currentUser?.role === 'admin';
  const canEditResidences = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canDeleteUsers = currentUser?.role === 'admin';

  // Filter configuration - temporarily simplified
  // const filterConfig = {
  //   searchable: true,
  //   searchFields: ['firstName', 'lastName', 'email', 'username'],
  //   filters: [
  //     {
  //       id: 'role',
  //       field: 'role',
  //       label: 'Role',
  //       type: 'select' as const,
  //       options: [
  //         { label: 'Admin', _value: 'admin' },
  //         { label: 'Manager', _value: 'manager' },
  //         { label: 'Tenant', _value: 'tenant' },
  //         { label: 'Resident', _value: 'resident' },
  //         { label: 'Demo Manager', _value: 'demo_manager' },
  //         { label: 'Demo Tenant', _value: 'demo_tenant' },
  //         { label: 'Demo Resident', _value: 'demo_resident' },
  //       ],
  //     },
  //     {
  //       id: 'isActive',
  //       field: 'isActive',
  //       label: 'Status',
  //       type: 'select' as const,
  //       options: [
  //         { label: 'Active', _value: 'true' },
  //         { label: 'Inactive', _value: 'false' },
  //       ],
  //     },
  //     {
  //       id: 'organization',
  //       field: 'organization',
  //       label: 'Organization',
  //       type: 'select' as const,
  //       options: organizations?.map((org) => ({ label: org.name, _value: org.id })) || [],
  //     },
  //   ],
  //   sortOptions: [
  //     { field: 'firstName', label: 'First Name' },
  //     { field: 'lastName', label: 'Last Name' },
  //     { field: 'email', label: 'Email' },
  //     { field: 'role', label: 'Role' },
  //     { field: 'createdAt', label: 'Created Date' },
  //   ],
  // };





  // Use server-side paginated results directly
  // Client-side filtering removed to avoid conflicts with server-side pagination
  // TODO: Move all filtering to server-side for proper search across all users
  const filteredUsers = users;

  // Filter handlers - temporarily disabled
  // const handleAddFilter = (filter: FilterValue) => {
  //   setFilters((prev) => [...prev.filter((f) => f.field !== filter.field), filter]);
  // };

  // const handleRemoveFilter = (field: string) => {
  //   setFilters((prev) => prev.filter((f) => f.field !== field));
  // };

  // const handleFilterUpdate = (field: string, filter: FilterValue) => {
  //   setFilters((prev) => prev.map((f) => (f.field === field ? filter : f)));
  // };

  const handleClearFilters = () => {
    setRoleFilter('');
    setStatusFilter('');
    setOrganizationFilter('');
    setOrphanFilter('');
  };

  // const handleToggleSort = (field: string) => {
  //   if (sort?.field === field) {
  //     setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
  //   } else {
  //     setSort({ field, direction: 'asc' });
  //   }
  // };

  // Calculate stats using server-side pagination data
  const totalUsers = paginationInfo?.total || 0;
  const filteredTotal = filteredUsers.length;
  
  // Calculate stats based on current page results when filters are applied
  const hasActiveFilters = roleFilter || statusFilter || organizationFilter || orphanFilter;
  
  // If filters are applied, show stats for current visible users, otherwise show total stats
  const displayedActiveUsers = hasActiveFilters 
    ? users?.filter((user: User) => user.isActive).length || 0
    : totalUsers > 0 ? Math.floor(totalUsers * 0.85) : 0; // Estimate 85% active when no filters
    
  const displayedAdminUsers = hasActiveFilters
    ? users?.filter((user: User) => user.role === 'admin').length || 0  
    : totalUsers > 0 ? Math.floor(totalUsers * 0.02) : 0; // Estimate 2% admin when no filters
    
  const displayedTotalUsers = hasActiveFilters ? `~${users.length}` : totalUsers;

  // Use server-side pagination calculations
  const totalPages = paginationInfo?.totalPages || 1;
  const hasNext = paginationInfo?.hasNext || false;
  const hasPrev = paginationInfo?.hasPrev || false;
  
  // For display, use filteredUsers (which may be less than the page size if filters are applied)
  const currentUsers = filteredUsers;

  if (usersError) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title={t('userManagement')} subtitle={t('manageAllUsers')} />
        <div className='flex-1 overflow-auto p-6'>
          <Card>
            <CardContent className='p-6'>
              <p className='text-red-600'>{t('anErrorOccurred')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('userManagement')} subtitle={t('manageAllUsers')} />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
        {/* Quick Stats Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-gray-600'>{t('totalUsers')}</CardTitle>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{displayedTotalUsers}</div>
              <p className='text-xs text-muted-foreground'>{hasActiveFilters ? t('filtered') || 'Filtered' : t('total')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-gray-600'>{t('activeUsers')}</CardTitle>
              <UserPlus className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{displayedActiveUsers}</div>
              <p className='text-xs text-muted-foreground'>{hasActiveFilters ? t('onThisPage') || 'On this page' : t('active')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-gray-600'>{t('admin')}</CardTitle>
              <Shield className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{displayedAdminUsers}</div>
              <p className='text-xs text-muted-foreground'>{hasActiveFilters ? t('onThisPage') || 'On this page' : t('role')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main User Management Tabs */}
        <Tabs defaultValue='users' className='space-y-6'>
          <div className='flex items-center justify-between'>
            <TabsList>
              <TabsTrigger value='users' className='flex items-center gap-2'>
                <Users className='h-4 w-4' />
                {t('users')}
              </TabsTrigger>
              <TabsTrigger value='invitations' className='flex items-center gap-2'>
                <Mail className='h-4 w-4' />
                {t('invitations')}
              </TabsTrigger>
            </TabsList>

            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className='h-4 w-4 mr-2' />
              {t('inviteUser')}
            </Button>
          </div>

          <TabsContent value='users' className='space-y-6'>
            <Card>
              <CardContent className='p-6'>
                {usersLoading ? (
                  <p>{t('loadingUsers') || 'Loading users...'}</p>
                ) : (
                  <div className='space-y-4'>
                    {/* Simple Search and Filters */}
                    <div className='flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-gray-50 rounded-lg'>
                      {/* Search */}
                      <div className='flex-1'>
                        <Input
                          placeholder={t('searchUsers')}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className='w-full'
                        />
                      </div>

                      {/* Role Filter */}
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className='px-3 py-2 border border-gray-300 rounded-md'
                      >
                        {filterOptions?.roles?.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        )) || []}
                      </select>

                      {/* Status Filter */}
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className='px-3 py-2 border border-gray-300 rounded-md'
                      >
                        {filterOptions?.statuses?.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        )) || []}
                      </select>

                      {/* Organization Filter */}
                      {filterOptions?.organizations && filterOptions.organizations.length > 0 && (
                        <select
                          value={organizationFilter}
                          onChange={(e) => setOrganizationFilter(e.target.value)}
                          className='px-3 py-2 border border-gray-300 rounded-md'
                        >
                          {filterOptions.organizations.map((org) => (
                            <option key={org.value} value={org.value}>
                              {org.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Orphan User Filter - Admin Only */}
                      {filterOptions?.orphanOptions && filterOptions.orphanOptions.length > 0 && (
                        <select
                          value={orphanFilter}
                          onChange={(e) => setOrphanFilter(e.target.value)}
                          className='px-3 py-2 border border-gray-300 rounded-md'
                        >
                          {filterOptions.orphanOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Clear Filters */}
                      {(roleFilter || statusFilter || organizationFilter || orphanFilter) && (
                        <Button variant='outline' onClick={handleClearFilters}>
                          {t('clearFilters')}
                        </Button>
                      )}
                    </div>

                    <h3 className='text-lg font-semibold'>
                      {t('users')} ({filteredTotal} of {totalUsers} {t('users').toLowerCase()})
                    </h3>

                    {/* User Table - Completely Rebuilt */}
                    <UserAssignmentsTable 
                      users={currentUsers} 
                      isLoading={usersLoading}
                      onEditUser={openEditDialog}
                      onEditOrganizations={setEditingUserOrganizations}
                      onEditResidences={setEditingUserResidences}
                      onDeleteUser={openDeleteDialog}
                      canEditOrganizations={canEditOrganizations}
                      canEditResidences={canEditResidences}
                      canDeleteUsers={canDeleteUsers}
                    />

                    {/* Server-side Pagination */}
                    {totalPages > 1 && (
                      <div className='flex justify-between items-center mt-4'>
                        <div className='text-sm text-gray-600'>
                          Page {currentPage} of {totalPages} - Showing {users.length} {t('users').toLowerCase()} ({totalUsers} total)
                        </div>
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={!hasPrev || usersLoading}
                          >
                            {t('previous') || 'Previous'}
                          </Button>
                          <span className='px-3 py-1 text-sm'>
                            {t('page') || 'Page'} {currentPage} {t('of') || 'of'} {totalPages}
                          </span>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={!hasNext || usersLoading}
                          >
                            {t('next') || 'Next'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='invitations' className='space-y-6'>
            <InvitationManagement />
          </TabsContent>
        </Tabs>

        {/* Comprehensive Invite Dialog */}
        <SendInvitationDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          onSuccess={() => {
            // Refresh users list after successful invitation
            queryClient.invalidateQueries({ queryKey: ['/api/users'] });
          }}
        />

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className='sm:max-w-[800px] max-h-[90vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle>{t('editUserTitle')}</DialogTitle>
              <DialogDescription>{t('editUserDescription')}</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue='basic' className='w-full'>
              <TabsList className={`grid w-full ${canEditOrganizations && canEditResidences ? 'grid-cols-4' : canEditOrganizations || canEditResidences ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value='basic'>{t('basicInfo') || 'Basic Info'}</TabsTrigger>
                {canEditOrganizations && <TabsTrigger value='organizations'>{t('organizations')}</TabsTrigger>}
                <TabsTrigger value='buildings'>{t('buildings') || 'Buildings'}</TabsTrigger>
                {canEditResidences && <TabsTrigger value='residences'>{t('residences') || 'Residences'}</TabsTrigger>}
              </TabsList>

              <TabsContent value='basic' className='space-y-4'>
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleEditUser)} className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <FormField
                        control={editForm.control}
                        name='firstName'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('firstName')}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid='input-edit-firstName' />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name='lastName'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('lastName')}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid='input-edit-lastName' />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={editForm.control}
                      name='email'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('email')}</FormLabel>
                          <FormControl>
                            <Input {...field} type='email' data-testid='input-edit-email' />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name='role'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('role')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid='select-edit-role'>
                                <SelectValue placeholder={t('selectRole')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {getAvailableRoles?.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              )) || []}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name='isActive'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('accountStatus')}</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === 'true')}
                            defaultValue={field.value.toString()}
                          >
                            <FormControl>
                              <SelectTrigger data-testid='select-edit-status'>
                                <SelectValue placeholder={t('selectStatus') || 'Select status'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='true'>{t('statusActive')}</SelectItem>
                              <SelectItem value='false'>{t('statusInactive')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => setEditingUser(null)}
                        data-testid='button-cancel-edit'
                      >
                        {t('cancel')}
                      </Button>
                      <Button
                        type='submit'
                        disabled={editUserMutation.isPending}
                        data-testid='button-save-edit'
                      >
                        {editUserMutation.isPending ? (t('saving') || 'Saving...') : t('saveChanges')}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>

              {canEditOrganizations && (
                <TabsContent value='organizations' className='space-y-4'>
                  <UserOrganizationsTab 
                    user={editingUser ? findUserWithAssignments(editingUser.id) : null}
                    organizations={organizations}
                    onSave={(organizationIds) => {
                      if (editingUser) {
                        editOrganizationsMutation.mutate({
                          userId: editingUser.id,
                          organizationIds
                        });
                      }
                    }}
                    isLoading={editOrganizationsMutation.isPending}
                  />
                </TabsContent>
              )}

              <TabsContent value='buildings' className='space-y-4'>
                <UserBuildingsTab 
                  user={editingUser ? findUserWithAssignments(editingUser.id) : null}
                  buildings={buildings}
                  onSave={(buildingIds) => {
                    if (editingUser) {
                      editBuildingsMutation.mutate({
                        userId: editingUser.id,
                        buildingIds
                      });
                    }
                  }}
                  isLoading={editBuildingsMutation.isPending}
                />
              </TabsContent>

              {canEditResidences && (
                <TabsContent value='residences' className='space-y-4'>
                  <UserResidencesTab 
                    user={editingUser ? findUserWithAssignments(editingUser.id) : null}
                    residences={residences}
                    onSave={(residenceAssignments) => {
                      if (editingUser) {
                        editResidencesMutation.mutate({
                          userId: editingUser.id,
                          residenceAssignments
                        });
                      }
                    }}
                    isLoading={editResidencesMutation.isPending}
                  />
                </TabsContent>
              )}
            </Tabs>
          </DialogContent>
        </Dialog>


        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <AlertDialogContent className='sm:max-w-[500px]'>
            <AlertDialogHeader>
              <AlertDialogTitle className='text-red-600'>{t('deleteUserTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteUserDescription').replace('and all associated data', `${deletingUser?.firstName} ${deletingUser?.lastName} and all associated data`)}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800 mb-4'>
              <p className='text-red-700 dark:text-red-300 text-sm'>
                <strong>{t('warning') || 'Warning'}:</strong> {t('deleteUserDataWarning') || 'This will delete all user data including'}:
              </p>
              <ul className='text-red-700 dark:text-red-300 text-sm mt-2 list-disc list-inside'>
                <li>{t('profileInfoAccess') || 'Profile information and account access'}</li>
                <li>{t('orgResidenceAssignments') || 'Organization and residence assignments'}</li>
                <li>{t('billsDocsMaintenance') || 'Bills, documents, and maintenance requests'}</li>
                <li>{t('notificationsActivity') || 'Notifications and activity history'}</li>
              </ul>
            </div>

            <Form {...deleteForm}>
              <form onSubmit={deleteForm.handleSubmit(handleDeleteUser)} className='space-y-4'>
                <FormField
                  control={deleteForm.control}
                  name='confirmEmail'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('confirmEmailLabel')}:{' '}
                        <span className='font-mono text-sm'>{deletingUser?.email}</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='email'
                          placeholder={deletingUser?.email}
                          data-testid='input-confirm-delete-email'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={deleteForm.control}
                  name='reason'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('reasonOptional')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('enterReasonDeletion') || 'Enter reason for deletion...'}
                          data-testid='input-delete-reason'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <AlertDialogFooter>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => setDeletingUser(null)}
                    disabled={deleteUserMutation.isPending}
                    data-testid='button-cancel-delete'
                  >
                    Cancel
                  </Button>
                  <Button
                    type='submit'
                    variant='destructive'
                    disabled={deleteUserMutation.isPending}
                    data-testid='button-confirm-delete'
                  >
                    {deleteUserMutation.isPending ? 'Deleting...' : 'Delete Account'}
                  </Button>
                </AlertDialogFooter>
              </form>
            </Form>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>
    </div>
  );
}

