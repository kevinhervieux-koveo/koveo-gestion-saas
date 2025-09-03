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

// Form validation schema for editing users
const editUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident']),
  isActive: z.boolean(),
});

// Form validation schema for deleting users
const deleteUserSchema = z.object({
  confirmEmail: z.string().email('Invalid email address'),
  reason: z.string().optional(),
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

  // Filter and search state
  const [filters, setFilters] = useState<FilterValue[]>([]);
  const [sort, setSort] = useState<SortValue | null>(null);
  const [search, setSearch] = useState('');

  // Fetch users 
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
  } = useQuery<UserWithAssignments[]>({
    queryKey: ['/api/users']
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

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (userData: z.infer<typeof editUserSchema> & { id: string }) => {
      const response = await apiRequest('PUT', `/api/users/${userData.id}`, userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
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
        title: 'Success',
        description: 'Organization assignments updated successfully',
      });
      setEditingUserOrganizations(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-user-organizations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
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
        title: 'Success',
        description: 'Building assignments updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
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
        title: 'Success',
        description: 'Residence assignments updated successfully',
      });
      setEditingUserResidences(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-user-residences'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
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
        title: 'Account deleted',
        description: 'User account and all associated data have been permanently deleted.',
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
        title: 'Deletion failed',
        description: error.message || 'Failed to delete account',
        variant: 'destructive',
      });
    },
  });

  // Permission checks
  const canEditOrganizations = currentUser?.role === 'admin';
  const canEditResidences = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canDeleteUsers = currentUser?.role === 'admin';

  // Filter configuration
  const filterConfig = {
    searchable: true,
    searchFields: ['firstName', 'lastName', 'email', 'username'],
    filters: [
      {
        id: 'role',
        field: 'role',
        label: 'Role',
        type: 'select' as const,
        options: [
          { label: 'Admin', _value: 'admin' },
          { label: 'Manager', _value: 'manager' },
          { label: 'Tenant', _value: 'tenant' },
          { label: 'Resident', _value: 'resident' },
          { label: 'Demo Manager', _value: 'demo_manager' },
          { label: 'Demo Tenant', _value: 'demo_tenant' },
          { label: 'Demo Resident', _value: 'demo_resident' },
        ],
      },
      {
        id: 'isActive',
        field: 'isActive',
        label: 'Status',
        type: 'select' as const,
        options: [
          { label: 'Active', _value: 'true' },
          { label: 'Inactive', _value: 'false' },
        ],
      },
      {
        id: 'organization',
        field: 'organization',
        label: 'Organization',
        type: 'select' as const,
        options: organizations?.map((org) => ({ label: org.name, _value: org.id })) || [],
      },
    ],
    sortOptions: [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'email', label: 'Email' },
      { field: 'role', label: 'Role' },
      { field: 'createdAt', label: 'Created Date' },
    ],
  };





  // Apply filters, search, and sort
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (user) =>
          user.firstName?.toLowerCase().includes(searchLower) ||
          user.lastName?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.username?.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    filters.forEach((filter) => {
      switch (filter.field) {
        case 'role':
          result = result.filter((user) => user.role === filter._value);
          break;
        case 'isActive':
          result = result.filter((user) => user.isActive.toString() === filter._value);
          break;
        case 'organization':
          result = result.filter((user) =>
            user.organizations.some((org) => org.id === filter._value)
          );
          break;
      }
    });

    // Apply sort
    if (sort) {
      result.sort((a, b) => {
        let aVal = a[sort.field as keyof typeof a];
        let bVal = b[sort.field as keyof typeof b];

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
        }
        if (typeof bVal === 'string') {
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) {
          return sort.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sort.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [users, search, filters, sort]);

  // Filter handlers
  const handleAddFilter = (filter: FilterValue) => {
    setFilters((prev) => [...prev.filter((f) => f.field !== filter.field), filter]);
  };

  const handleRemoveFilter = (field: string) => {
    setFilters((prev) => prev.filter((f) => f.field !== field));
  };

  const handleFilterUpdate = (field: string, filter: FilterValue) => {
    setFilters((prev) => prev.map((f) => (f.field === field ? filter : f)));
  };

  const handleClearFilters = () => {
    setFilters([]);
    setSearch('');
    setSort(null);
  };

  const handleToggleSort = (field: string) => {
    if (sort?.field === field) {
      setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ field, direction: 'asc' });
    }
  };

  // Calculate stats and pagination
  const totalUsers = users?.length || 0;
  const filteredTotal = filteredUsers.length;
  const activeUsers = users?.filter((user: User) => user.isActive).length || 0;
  const adminUsers = users?.filter((user: User) => user.role === 'admin').length || 0;

  // Pagination calculations
  const totalPages = Math.ceil(filteredTotal / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  if (usersError) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='User Management' subtitle='Manage All Users' />
        <div className='flex-1 overflow-auto p-6'>
          <Card>
            <CardContent className='p-6'>
              <p className='text-red-600'>An error occurred</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='User Management' subtitle='Manage All Users' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
        {/* Quick Stats Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-gray-600'>Total Users</CardTitle>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{totalUsers}</div>
              <p className='text-xs text-muted-foreground'>Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-gray-600'>Active Users</CardTitle>
              <UserPlus className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{activeUsers}</div>
              <p className='text-xs text-muted-foreground'>Active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-gray-600'>Admin</CardTitle>
              <Shield className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{adminUsers}</div>
              <p className='text-xs text-muted-foreground'>Role</p>
            </CardContent>
          </Card>
        </div>

        {/* Main User Management Tabs */}
        <Tabs defaultValue='users' className='space-y-6'>
          <div className='flex items-center justify-between'>
            <TabsList>
              <TabsTrigger value='users' className='flex items-center gap-2'>
                <Users className='h-4 w-4' />
                Users
              </TabsTrigger>
              <TabsTrigger value='invitations' className='flex items-center gap-2'>
                <Mail className='h-4 w-4' />
                Invitations
              </TabsTrigger>
            </TabsList>

            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className='h-4 w-4 mr-2' />
              Invite User
            </Button>
          </div>

          <TabsContent value='users' className='space-y-6'>
            <Card>
              <CardContent className='p-6'>
                {usersLoading ? (
                  <p>Loading users...</p>
                ) : (
                  <div className='space-y-4'>
                    {/* Simple Search and Filters */}
                    <div className='flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-gray-50 rounded-lg'>
                      {/* Search */}
                      <div className='flex-1'>
                        <Input
                          placeholder='Search users by name, email, or username...'
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className='w-full'
                        />
                      </div>

                      {/* Role Filter */}
                      <select
                        value={filters.find((f) => f.field === 'role')?._value || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddFilter({
                              field: 'role',
                              operator: 'equals',
                              _value: e.target.value,
                            });
                          } else {
                            handleRemoveFilter('role');
                          }
                        }}
                        className='px-3 py-2 border border-gray-300 rounded-md'
                      >
                        <option value=''>All Roles</option>
                        <option value='admin'>Admin</option>
                        <option value='manager'>Manager</option>
                        <option value='tenant'>Tenant</option>
                        <option value='resident'>Resident</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={filters.find((f) => f.field === 'isActive')?._value || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddFilter({
                              field: 'isActive',
                              operator: 'equals',
                              _value: e.target.value,
                            });
                          } else {
                            handleRemoveFilter('isActive');
                          }
                        }}
                        className='px-3 py-2 border border-gray-300 rounded-md'
                      >
                        <option value=''>All Status</option>
                        <option value='true'>Active</option>
                        <option value='false'>Inactive</option>
                      </select>

                      {/* Organization Filter */}
                      {organizations.length > 0 && (
                        <select
                          value={filters.find((f) => f.field === 'organization')?._value || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddFilter({
                                field: 'organization',
                                operator: 'equals',
                                _value: e.target.value,
                              });
                            } else {
                              handleRemoveFilter('organization');
                            }
                          }}
                          className='px-3 py-2 border border-gray-300 rounded-md'
                        >
                          <option value=''>All Organizations</option>
                          {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Clear Filters */}
                      {(filters.length > 0 || search) && (
                        <Button variant='outline' onClick={handleClearFilters}>
                          Clear All
                        </Button>
                      )}
                    </div>

                    <h3 className='text-lg font-semibold'>
                      User List ({filteredTotal} of {totalUsers} users)
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className='flex justify-between items-center mt-4'>
                        <div className='text-sm text-gray-600'>
                          Showing {startIndex + 1}-{Math.min(endIndex, filteredTotal)} of{' '}
                          {filteredTotal} filtered users ({totalUsers} total)
                        </div>
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <span className='px-3 py-1 text-sm'>
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                          >
                            Next
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
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information, organizations, buildings, and residences.</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue='basic' className='w-full'>
              <TabsList className={`grid w-full ${canEditOrganizations && canEditResidences ? 'grid-cols-4' : canEditOrganizations || canEditResidences ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value='basic'>Basic Info</TabsTrigger>
                {canEditOrganizations && <TabsTrigger value='organizations'>Organizations</TabsTrigger>}
                <TabsTrigger value='buildings'>Buildings</TabsTrigger>
                {canEditResidences && <TabsTrigger value='residences'>Residences</TabsTrigger>}
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
                            <FormLabel>First Name</FormLabel>
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
                            <FormLabel>Last Name</FormLabel>
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
                          <FormLabel>Email</FormLabel>
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
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid='select-edit-role'>
                                <SelectValue placeholder='Select role' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='admin'>Admin</SelectItem>
                              <SelectItem value='manager'>Manager</SelectItem>
                              <SelectItem value='tenant'>Tenant</SelectItem>
                              <SelectItem value='resident'>Resident</SelectItem>
                              <SelectItem value='demo_manager'>Demo Manager</SelectItem>
                              <SelectItem value='demo_tenant'>Demo Tenant</SelectItem>
                              <SelectItem value='demo_resident'>Demo Resident</SelectItem>
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
                          <FormLabel>Status</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === 'true')}
                            defaultValue={field.value.toString()}
                          >
                            <FormControl>
                              <SelectTrigger data-testid='select-edit-status'>
                                <SelectValue placeholder='Select status' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='true'>Active</SelectItem>
                              <SelectItem value='false'>Inactive</SelectItem>
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
                        Cancel
                      </Button>
                      <Button
                        type='submit'
                        disabled={editUserMutation.isPending}
                        data-testid='button-save-edit'
                      >
                        {editUserMutation.isPending ? 'Saving...' : 'Save Changes'}
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
              <AlertDialogTitle className='text-red-600'>Delete User Account</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{' '}
                <strong>
                  {deletingUser?.firstName} {deletingUser?.lastName}
                </strong>{' '}
                and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800 mb-4'>
              <p className='text-red-700 dark:text-red-300 text-sm'>
                <strong>Warning:</strong> This will delete all user data including:
              </p>
              <ul className='text-red-700 dark:text-red-300 text-sm mt-2 list-disc list-inside'>
                <li>Profile information and account access</li>
                <li>Organization and residence assignments</li>
                <li>Bills, documents, and maintenance requests</li>
                <li>Notifications and activity history</li>
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
                        Confirm by typing the user's email address:{' '}
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
                      <FormLabel>Reason for deletion (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder='Enter reason for deletion...'
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

