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
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Users, UserPlus, Shield, Mail } from 'lucide-react';
import { SendInvitationDialog } from '@/components/admin/send-invitation-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User, Organization, Building, Residence } from '@shared/schema';
import type { FilterValue, SortValue } from '@/lib/filter-sort/types';

// Form validation schema for editing users
const editUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
  isActive: z.boolean()
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  // Filter and search state
  const [filters, setFilters] = useState<FilterValue[]>([]);
  const [sort, setSort] = useState<SortValue | null>(null);
  const [search, setSearch] = useState('');

  // Fetch users
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: true,
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

  // Fetch user organizations
  const { data: userOrganizations = [] } = useQuery<any[]>({
    queryKey: ['/api/user-organizations'],
    enabled: true,
  });

  // Fetch user residences
  const { data: userResidences = [] } = useQuery<any[]>({
    queryKey: ['/api/user-residences'],
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
      isActive: true
    }
  });

  // Reset form when editing user changes
  React.useEffect(() => {
    if (editingUser) {
      editForm.reset({
        firstName: editingUser.firstName || '',
        lastName: editingUser.lastName || '',
        email: editingUser.email,
        role: editingUser.role,
        isActive: editingUser.isActive
      });
    }
  }, [editingUser, editForm]);

  const handleEditUser = async (values: z.infer<typeof editUserSchema>) => {
    if (!editingUser) return;
    await editUserMutation.mutateAsync({ ...values, id: editingUser.id });
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
  };

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
        ]
      },
      {
        id: 'isActive',
        field: 'isActive',
        label: 'Status',
        type: 'select' as const,
        options: [
          { label: 'Active', _value: 'true' },
          { label: 'Inactive', _value: 'false' },
        ]
      },
      {
        id: 'organization',
        field: 'organization',
        label: 'Organization',
        type: 'select' as const,
        options: organizations?.map(org => ({ label: org.name, _value: org.id })) || []
      }
    ],
    sortOptions: [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'email', label: 'Email' },
      { field: 'role', label: 'Role' },
      { field: 'createdAt', label: 'Created Date' },
    ]
  };

  // Enhanced user data with relationships
  const enhancedUsers = useMemo(() => {
    return users.map(user => {
      const userOrgRelations = userOrganizations.filter(uo => uo.userId === user.id);
      const userOrgs = userOrgRelations.map(uo => 
        organizations.find(org => org.id === uo.organizationId)
      ).filter(Boolean);
      
      const userResRelations = userResidences.filter(ur => ur.userId === user.id);
      const userRes = userResRelations.map(ur => 
        residences.find(res => res.id === ur.residenceId)
      ).filter(Boolean);
      
      const userBuildings = userRes.map(res => 
        buildings.find(building => building.id === res.buildingId)
      ).filter(Boolean);
      
      return {
        ...user,
        organizations: userOrgs,
        residences: userRes,
        buildings: userBuildings,
      };
    });
  }, [users, organizations, buildings, residences, userOrganizations, userResidences]);

  // Apply filters, search, and sort
  const filteredUsers = useMemo(() => {
    let result = [...enhancedUsers];
    
    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(user => 
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.username?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply filters
    filters.forEach(filter => {
      switch (filter.field) {
        case 'role':
          result = result.filter(user => user.role === filter._value);
          break;
        case 'isActive':
          result = result.filter(user => user.isActive.toString() === filter._value);
          break;
        case 'organization':
          result = result.filter(user => 
            user.organizations.some(org => org.id === filter._value)
          );
          break;
      }
    });
    
    // Apply sort
    if (sort) {
      result.sort((a, b) => {
        let aVal = a[sort.field as keyof typeof a];
        let bVal = b[sort.field as keyof typeof b];
        
        if (typeof aVal === 'string') {aVal = aVal.toLowerCase();}
        if (typeof bVal === 'string') {bVal = bVal.toLowerCase();}
        
        if (aVal < bVal) {return sort.direction === 'asc' ? -1 : 1;}
        if (aVal > bVal) {return sort.direction === 'asc' ? 1 : -1;}
        return 0;
      });
    }
    
    return result;
  }, [enhancedUsers, search, filters, sort]);

  // Filter handlers
  const handleAddFilter = (filter: FilterValue) => {
    setFilters(prev => [...prev.filter(f => f.field !== filter.field), filter]);
  };

  const handleRemoveFilter = (field: string) => {
    setFilters(prev => prev.filter(f => f.field !== field));
  };

  const handleFilterUpdate = (field: string, filter: FilterValue) => {
    setFilters(prev => prev.map(f => f.field === field ? filter : f));
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

            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                {usersLoading ? (
                  <p>Loading users...</p>
                ) : (
                  <div className="space-y-4">
                    {/* Simple Search and Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      {/* Search */}
                      <div className="flex-1">
                        <Input
                          placeholder="Search users by name, email, or username..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      
                      {/* Role Filter */}
                      <select
                        value={filters.find(f => f.field === 'role')?._value || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddFilter({ field: 'role', operator: 'equals', _value: e.target.value });
                          } else {
                            handleRemoveFilter('role');
                          }
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="tenant">Tenant</option>
                        <option value="resident">Resident</option>
                      </select>
                      
                      {/* Status Filter */}
                      <select
                        value={filters.find(f => f.field === 'isActive')?._value || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddFilter({ field: 'isActive', operator: 'equals', _value: e.target.value });
                          } else {
                            handleRemoveFilter('isActive');
                          }
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                      
                      {/* Organization Filter */}
                      {organizations.length > 0 && (
                        <select
                          value={filters.find(f => f.field === 'organization')?._value || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddFilter({ field: 'organization', operator: 'equals', _value: e.target.value });
                            } else {
                              handleRemoveFilter('organization');
                            }
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">All Organizations</option>
                          {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                          ))}
                        </select>
                      )}
                      
                      {/* Clear Filters */}
                      {(filters.length > 0 || search) && (
                        <Button
                          variant="outline"
                          onClick={handleClearFilters}
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold">User List ({filteredTotal} of {totalUsers} users)</h3>
                    
                    {/* User Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Role</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Organization(s)</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Buildings</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Residences</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2">
                                {user.firstName} {user.lastName}
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                {user.email}
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                  user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {user.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="space-y-1">
                                  {user.organizations.length > 0 ? (
                                    user.organizations.map((org, idx) => (
                                      <div key={idx} className="text-xs bg-blue-50 px-2 py-1 rounded">
                                        {org.name}
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-gray-400 text-xs">No organizations</span>
                                  )}
                                </div>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="space-y-1">
                                  {user.buildings.length > 0 ? (
                                    user.buildings.slice(0, 3).map((building, idx) => (
                                      <div key={idx} className="text-xs bg-purple-50 px-2 py-1 rounded">
                                        {building.name}
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-gray-400 text-xs">No buildings</span>
                                  )}
                                  {user.buildings.length > 3 && (
                                    <div className="text-xs text-gray-500">+{user.buildings.length - 3} more</div>
                                  )}
                                </div>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="space-y-1">
                                  {user.residences.length > 0 ? (
                                    user.residences.slice(0, 3).map((residence, idx) => (
                                      <div key={idx} className="text-xs bg-green-50 px-2 py-1 rounded">
                                        Unit {residence.unitNumber}
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-gray-400 text-xs">No residences</span>
                                  )}
                                  {user.residences.length > 3 && (
                                    <div className="text-xs text-gray-500">+{user.residences.length - 3} more</div>
                                  )}
                                </div>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openEditDialog(user)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex justify-between items-center mt-4">
                        <div className="text-sm text-gray-600">
                          Showing {startIndex + 1}-{Math.min(endIndex, filteredTotal)} of {filteredTotal} filtered users ({totalUsers} total)
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="px-3 py-1 text-sm">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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

          <TabsContent value="invitations" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <p>Invitations management coming soon...</p>
              </CardContent>
            </Card>
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and permissions.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditUser)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-firstName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-lastName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-edit-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="tenant">Tenant</SelectItem>
                          <SelectItem value="resident">Resident</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === 'true')} 
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">Active</SelectItem>
                          <SelectItem value="false">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingUser(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={editUserMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {editUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}